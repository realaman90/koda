/**
 * S3-Compatible Asset Storage Provider
 * 
 * Works with both Cloudflare R2 and AWS S3.
 * Uses the native fetch API with AWS Signature V4 for authentication.
 */

import type {
  AssetStorageProvider,
  StoredAsset,
  SaveAssetOptions,
  AssetStorageType,
} from './types';
import { generateAssetId, getMimeType, getExtensionFromUrl } from './types';

/**
 * S3 Configuration
 */
interface S3Config {
  type: 'r2' | 's3';
  accountId?: string;      // R2 only
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  endpoint?: string;       // Custom endpoint for R2
  publicUrl?: string;      // Public URL for serving assets
}

/**
 * Get S3 configuration from environment
 */
function getS3Config(type: AssetStorageType): S3Config | null {
  if (type === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }

    // Allow custom endpoint for jurisdiction-specific URLs (e.g., EU)
    // Default: https://{accountId}.r2.cloudflarestorage.com
    // EU example: https://{accountId}.eu.r2.cloudflarestorage.com
    const defaultEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const endpoint = process.env.R2_ENDPOINT || defaultEndpoint;

    return {
      type: 'r2',
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: 'auto',
      endpoint,
      publicUrl: process.env.R2_PUBLIC_URL,
    };
  }

  if (type === 's3') {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }

    return {
      type: 's3',
      accessKeyId,
      secretAccessKey,
      bucket,
      region,
      publicUrl: process.env.S3_PUBLIC_URL,
    };
  }

  return null;
}

/**
 * AWS Signature V4 signing utilities
 */
async function sha256(message: string | Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = typeof message === 'string' ? encoder.encode(message) : message;
  return await crypto.subtle.digest('SHA-256', data);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function getSignatureKey(
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

/**
 * URI encode a string for S3 signing (RFC 3986)
 */
function uriEncode(str: string, encodeSlash = true): string {
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
 * Sign an S3 request with AWS Signature V4
 */
async function signRequest(
  config: S3Config,
  method: string,
  key: string,
  body?: Uint8Array,
  contentType?: string
): Promise<{ url: string; headers: Record<string, string> }> {
  const service = 's3';
  const region = config.region;
  
  // Build the endpoint URL
  let host: string;
  if (config.endpoint) {
    const url = new URL(config.endpoint);
    host = url.host;
  } else {
    host = `${config.bucket}.s3.${region}.amazonaws.com`;
  }

  // URI encode the key (but not the slashes)
  const encodedKey = uriEncode(key, false);

  const endpoint = config.endpoint 
    ? `${config.endpoint}/${config.bucket}/${encodedKey}`
    : `https://${host}/${encodedKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Create canonical request
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

  // Canonical URI must be URI-encoded
  const canonicalUri = config.endpoint 
    ? `/${config.bucket}/${encodedKey}`
    : `/${encodedKey}`;

  const canonicalRequest = [
    method,
    canonicalUri,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n');

  // Calculate signature
  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  // Build authorization header
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

/**
 * S3-compatible asset storage provider
 */
export class S3AssetProvider implements AssetStorageProvider {
  private config: S3Config;
  private storageType: AssetStorageType;

  constructor(type: AssetStorageType) {
    const config = getS3Config(type);
    if (!config) {
      throw new Error(`Missing ${type.toUpperCase()} configuration. Check environment variables.`);
    }
    this.config = config;
    this.storageType = type;
  }

  /**
   * Get the public URL for an asset
   */
  private getPublicUrl(key: string): string {
    if (this.config.publicUrl) {
      return `${this.config.publicUrl}/${key}`;
    }

    // Default public URL format
    if (this.config.type === 'r2') {
      // R2 requires a custom domain or R2.dev URL configured
      return `${this.config.endpoint}/${this.config.bucket}/${key}`;
    }

    // S3 default public URL
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  async saveFromUrl(remoteUrl: string, options: SaveAssetOptions): Promise<StoredAsset> {
    // Download the file
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = options.extension || getExtensionFromUrl(remoteUrl);

    return this.saveFromBuffer(buffer, { ...options, extension });
  }

  async saveFromBuffer(buffer: Buffer, options: SaveAssetOptions): Promise<StoredAsset> {
    const id = options.id || generateAssetId(options.type);
    const extension = options.extension;
    const key = `${id}.${extension}`;
    const mimeType = options.metadata.mimeType || getMimeType(extension);

    // Upload to S3/R2
    const { url, headers } = await signRequest(
      this.config,
      'PUT',
      key,
      buffer,
      mimeType
    );

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload asset: ${response.status} ${errorText}`);
    }

    // Create asset record
    const asset: StoredAsset = {
      id,
      type: options.type,
      url: this.getPublicUrl(key),
      key,
      metadata: {
        ...options.metadata,
        mimeType,
        sizeBytes: buffer.length,
      },
      createdAt: Date.now(),
    };

    return asset;
  }

  async get(id: string): Promise<StoredAsset | null> {
    // For S3/R2, we don't have a manifest, so we can't get metadata
    // In a full implementation, you'd store metadata in the database
    // For now, return null and rely on the database for lookups
    return null;
  }

  async delete(id: string): Promise<void> {
    // We need the key (with extension), which we don't have without metadata
    // In production, you'd look this up from the database
    // For now, try common extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mp3'];
    
    for (const ext of extensions) {
      const key = `${id}.${ext}`;
      try {
        const { url, headers } = await signRequest(this.config, 'DELETE', key);
        await fetch(url, { method: 'DELETE', headers });
      } catch {
        // Ignore errors, file might not exist with this extension
      }
    }
  }

  async deleteByCanvas(canvasId: string): Promise<number> {
    // This requires listing objects with a prefix, which is more complex
    // In production, you'd track assets in the database and delete by ID
    console.warn('deleteByCanvas not fully implemented for S3 provider');
    return 0;
  }

  async listByCanvas(canvasId: string): Promise<StoredAsset[]> {
    // This requires listing objects, which needs database tracking
    console.warn('listByCanvas not fully implemented for S3 provider');
    return [];
  }

  getUrl(id: string): string {
    // Without knowing the extension, we can't build the full URL
    // This would be looked up from the database in production
    return this.getPublicUrl(id);
  }
}

// Factory function
export function getS3AssetProvider(type: 'r2' | 's3'): S3AssetProvider {
  return new S3AssetProvider(type);
}
