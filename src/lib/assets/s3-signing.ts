/**
 * AWS Signature V4 Signing Utilities
 *
 * Shared between S3AssetProvider and R2SnapshotProvider.
 * Uses Web Crypto API (available in Node.js 20+ and all modern runtimes).
 */

export interface S3Config {
  type: 'r2' | 's3';
  accountId?: string;      // R2 only
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  endpoint?: string;       // Custom endpoint for R2
  publicUrl?: string;      // Public URL for serving assets
}

export async function sha256(message: string | Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = typeof message === 'string' ? encoder.encode(message) : message;
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return await crypto.subtle.digest('SHA-256', buffer);
}

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  let keyBuffer: ArrayBuffer;
  if (key instanceof Uint8Array) {
    keyBuffer = new ArrayBuffer(key.byteLength);
    new Uint8Array(keyBuffer).set(key);
  } else {
    keyBuffer = key;
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

export async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(encoder.encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}

export function uriEncode(str: string, encodeSlash = true): string {
  return str.split('').map(char => {
    if (
      (char >= 'A' && char <= 'Z') ||
      (char >= 'a' && char <= 'z') ||
      (char >= '0' && char <= '9') ||
      char === '_' || char === '-' || char === '~' || char === '.'
    ) {
      return char;
    }
    if (char === '/' && !encodeSlash) {
      return char;
    }
    return '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
  }).join('');
}

/**
 * Generate a presigned PUT URL for direct browser uploads.
 * Uses query-string based AWS Sig V4 (no auth headers needed by the client).
 * The browser can PUT the file body directly to this URL.
 */
export async function generatePresignedPutUrl(
  config: S3Config,
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const service = 's3';
  const region = config.region;

  let host: string;
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    host = url.host;
  } else {
    host = `${config.bucket}.s3.${region}.amazonaws.com`;
  }

  const encodedKey = uriEncode(key, false);

  const endpoint = config.endpoint
    ? `${config.endpoint}/${config.bucket}/${encodedKey}`
    : `https://${host}/${encodedKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;

  // Query parameters for presigned URL (alphabetical order for canonical)
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host',
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map(k => `${uriEncode(k)}=${uriEncode(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `content-type:${contentType}\nhost:${config.endpoint ? new URL(config.endpoint).host : host}\n`;
  const signedHeaders = 'content-type;host';

  const canonicalUri = config.endpoint
    ? `/${config.bucket}/${encodedKey}`
    : `/${encodedKey}`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n');

  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `${endpoint}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export async function signRequest(
  config: S3Config,
  method: string,
  key: string,
  body?: Uint8Array,
  contentType?: string
): Promise<{ url: string; headers: Record<string, string> }> {
  const service = 's3';
  const region = config.region;

  let host: string;
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    host = url.host;
  } else {
    host = `${config.bucket}.s3.${region}.amazonaws.com`;
  }

  const encodedKey = uriEncode(key, false);

  const endpoint = config.endpoint
    ? `${config.endpoint}/${config.bucket}/${encodedKey}`
    : `https://${host}/${encodedKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = body
    ? toHex(await sha256(body))
    : 'UNSIGNED-PAYLOAD';

  const headers: Record<string, string> = {
    'host': config.endpoint ? new URL(config.endpoint).host : host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  if (contentType) {
    headers['content-type'] = contentType;
  }

  if (body) {
    headers['content-length'] = body.length.toString();
  }

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k}:${headers[k]}\n`)
    .join('');

  const canonicalUri = config.endpoint
    ? `/${config.bucket}/${encodedKey}`
    : `/${encodedKey}`;

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n');

  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return {
    url: endpoint,
    headers: {
      ...headers,
      'authorization': authorization,
    },
  };
}
