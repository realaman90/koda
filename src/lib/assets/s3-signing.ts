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

const EMPTY_PAYLOAD_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface RequestTarget {
  url: string;
  host: string;
  canonicalUri: string;
}

function joinPathSegments(...segments: string[]): string {
  return segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function getEndpointTarget(
  config: S3Config,
  encodedKey: string
): RequestTarget {
  if (!config.endpoint) {
    const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
    return {
      url: `https://${host}/${encodedKey}`,
      host,
      canonicalUri: `/${encodedKey}`,
    };
  }

  const parsed = new URL(config.endpoint.trim());
  const endpointPath = parsed.pathname.replace(/\/+$/, '');
  const pathSegments = endpointPath.split('/').filter(Boolean);
  const endpointIncludesBucket = pathSegments[pathSegments.length - 1] === config.bucket;
  const objectPath = joinPathSegments(
    endpointPath,
    endpointIncludesBucket ? '' : config.bucket,
    encodedKey
  );

  return {
    url: `${parsed.origin}/${objectPath}`,
    host: parsed.host,
    canonicalUri: `/${objectPath}`,
  };
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

  const encodedKey = uriEncode(key, false);
  const target = getEndpointTarget(config, encodedKey);

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

  const canonicalHeaders = `content-type:${contentType}\nhost:${target.host}\n`;
  const signedHeaders = 'content-type;host';

  const canonicalRequest = [
    'PUT',
    target.canonicalUri,
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

  return `${target.url}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
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

  const encodedKey = uriEncode(key, false);
  const target = getEndpointTarget(config, encodedKey);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = body
    ? toHex(await sha256(body))
    : EMPTY_PAYLOAD_SHA256;

  const headers: Record<string, string> = {
    'host': target.host,
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

  const canonicalRequest = [
    method,
    target.canonicalUri,
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
    url: target.url,
    headers: {
      ...headers,
      'authorization': authorization,
    },
  };
}
