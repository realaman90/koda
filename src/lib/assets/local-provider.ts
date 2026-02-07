/**
 * Local Filesystem Asset Storage Provider
 * 
 * SERVER-ONLY: This module uses Node.js fs API.
 * Only import from API routes.
 */
import 'server-only';

import * as fs from 'fs';
import * as path from 'path';
import type {
  AssetStorageProvider,
  StoredAsset,
  SaveAssetOptions,
  AssetMetadata,
} from './types';
import { generateAssetId, getMimeType, getExtensionFromUrl } from './types';

/**
 * Get the assets directory from environment or default
 */
function getAssetsDir(): string {
  return process.env.ASSET_LOCAL_PATH || './data/generations';
}

/**
 * Get the base URL for serving assets
 */
function getBaseUrl(): string {
  // In development, use relative path; in production, could be configured
  return process.env.ASSET_BASE_URL || '/api/assets';
}

/**
 * Asset manifest stored as JSON
 */
interface AssetManifest {
  assets: Record<string, StoredAsset>;
}

/**
 * Local filesystem asset storage provider
 */
export class LocalAssetProvider implements AssetStorageProvider {
  private assetsDir: string;
  private manifestPath: string;
  private manifest: AssetManifest | null = null;

  constructor() {
    this.assetsDir = getAssetsDir();
    this.manifestPath = path.join(this.assetsDir, 'manifest.json');
  }

  /**
   * Ensure the assets directory exists
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  /**
   * Load the manifest from disk
   */
  private loadManifest(): AssetManifest {
    if (this.manifest) return this.manifest;

    this.ensureDir();

    if (fs.existsSync(this.manifestPath)) {
      try {
        const data = fs.readFileSync(this.manifestPath, 'utf-8');
        this.manifest = JSON.parse(data);
      } catch (error) {
        console.error('Failed to load asset manifest:', error);
        this.manifest = { assets: {} };
      }
    } else {
      this.manifest = { assets: {} };
    }

    // TypeScript can't track that manifest is always set in the branches above
    return this.manifest!;
  }

  /**
   * Save the manifest to disk
   */
  private saveManifest(): void {
    if (!this.manifest) return;
    
    this.ensureDir();
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  /**
   * Get the file path for an asset
   */
  private getFilePath(id: string, extension: string): string {
    return path.join(this.assetsDir, `${id}.${extension}`);
  }

  async saveFromUrl(remoteUrl: string, options: SaveAssetOptions): Promise<StoredAsset> {
    // Download the file
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Determine extension from URL if not provided
    const extension = options.extension || getExtensionFromUrl(remoteUrl);
    
    return this.saveFromBuffer(buffer, { ...options, extension });
  }

  async saveFromBuffer(buffer: Buffer, options: SaveAssetOptions): Promise<StoredAsset> {
    this.ensureDir();
    const manifest = this.loadManifest();

    // Generate ID if not provided
    const id = options.id || generateAssetId(options.type);
    const extension = options.extension;
    const filePath = this.getFilePath(id, extension);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Get file stats
    const stats = fs.statSync(filePath);

    // Create asset record
    const asset: StoredAsset = {
      id,
      type: options.type,
      url: `${getBaseUrl()}/${id}`,
      key: `${id}.${extension}`,
      metadata: {
        ...options.metadata,
        mimeType: options.metadata.mimeType || getMimeType(extension),
        sizeBytes: stats.size,
      },
      createdAt: Date.now(),
    };

    // Save to manifest
    manifest.assets[id] = asset;
    this.saveManifest();

    return asset;
  }

  async get(id: string): Promise<StoredAsset | null> {
    const manifest = this.loadManifest();
    return manifest.assets[id] || null;
  }

  async delete(id: string): Promise<void> {
    const manifest = this.loadManifest();
    const asset = manifest.assets[id];

    if (asset) {
      // Delete file
      const filePath = path.join(this.assetsDir, asset.key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from manifest
      delete manifest.assets[id];
      this.saveManifest();
    }
  }

  async deleteByCanvas(canvasId: string): Promise<number> {
    const manifest = this.loadManifest();
    let count = 0;

    for (const [id, asset] of Object.entries(manifest.assets)) {
      if (asset.metadata.canvasId === canvasId) {
        // Delete file
        const filePath = path.join(this.assetsDir, asset.key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Remove from manifest
        delete manifest.assets[id];
        count++;
      }
    }

    if (count > 0) {
      this.saveManifest();
    }

    return count;
  }

  async listByCanvas(canvasId: string): Promise<StoredAsset[]> {
    const manifest = this.loadManifest();
    
    return Object.values(manifest.assets).filter(
      asset => asset.metadata.canvasId === canvasId
    );
  }

  getUrl(id: string): string {
    return `${getBaseUrl()}/${id}`;
  }

  /**
   * Get the raw file buffer for an asset
   * Used by the API route to serve the file
   */
  async getBuffer(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const manifest = this.loadManifest();
    const asset = manifest.assets[id];

    if (!asset) return null;

    const filePath = path.join(this.assetsDir, asset.key);
    
    if (!fs.existsSync(filePath)) {
      // File missing, clean up manifest
      delete manifest.assets[id];
      this.saveManifest();
      return null;
    }

    const buffer = fs.readFileSync(filePath);
    return {
      buffer,
      mimeType: asset.metadata.mimeType,
    };
  }
}

// Singleton instance
let instance: LocalAssetProvider | null = null;

export function getLocalAssetProvider(): LocalAssetProvider {
  if (!instance) {
    instance = new LocalAssetProvider();
  }
  return instance;
}
