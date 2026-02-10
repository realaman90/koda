#!/usr/bin/env node

/**
 * Create Showcase Template Script
 *
 * Converts an exported canvas JSON into a showcase template by:
 * 1. Downloading all generated images/videos from URLs
 * 2. Saving them to /public/templates/assets/[template-id]/
 * 3. Creating a template JSON file with local asset paths
 *
 * Usage:
 *   node scripts/create-showcase-template.mjs <exported-json-path> <template-id> [options]
 *
 * Example:
 *   node scripts/create-showcase-template.mjs ./my-export.json product-variations --name "Product Variations" --description "Create product variations in context"
 *
 * Options:
 *   --name         Template display name
 *   --description  Template description
 *   --tags         Comma-separated tags (featured,branding,photography,etc)
 *   --thumbnail    Path to thumbnail image (will be copied to /public/templates/)
 *   --keep-urls    Keep permanent cloud URLs (R2/S3) as-is instead of downloading.
 *                  Auto-detected when ASSET_STORAGE, R2_PUBLIC_URL, or S3_PUBLIC_URL
 *                  env vars are set in .env.local or .env.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables (.env.local takes precedence)
dotenv.config({ path: path.resolve(projectRoot, '.env.local') });
dotenv.config({ path: path.resolve(projectRoot, '.env') });

// Check if a URL points to permanent cloud storage and should be kept as-is
function isPermanentUrl(url) {
  // Non-http URLs (e.g. /api/assets/...) are treated as permanent/local
  if (!url.startsWith('http')) return true;

  // Check against configured R2 public URL
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (r2PublicUrl && url.startsWith(r2PublicUrl)) return true;

  // Check against configured S3 public URL
  const s3PublicUrl = process.env.S3_PUBLIC_URL;
  if (s3PublicUrl && url.startsWith(s3PublicUrl)) return true;

  // Fallback: match common R2 public bucket URL pattern
  if (/^https:\/\/pub-[a-f0-9]+\.r2\.dev\//.test(url)) return true;

  // Fallback: match common S3 bucket URL patterns
  if (/^https:\/\/[a-z0-9.-]+\.s3[.-][a-z0-9-]*\.amazonaws\.com\//.test(url)) return true;

  return false;
}

// Auto-detect whether cloud storage is configured
function shouldKeepUrls() {
  const storage = (process.env.ASSET_STORAGE || '').toLowerCase();
  if (storage === 'r2' || storage === 's3') return true;
  if (process.env.R2_PUBLIC_URL) return true;
  if (process.env.S3_PUBLIC_URL) return true;
  return false;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    inputPath: null,
    templateId: null,
    name: null,
    description: null,
    tags: [],
    thumbnail: null,
    keepUrls: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--name' && args[i + 1]) {
      result.name = args[i + 1];
      i += 2;
    } else if (arg === '--description' && args[i + 1]) {
      result.description = args[i + 1];
      i += 2;
    } else if (arg === '--tags' && args[i + 1]) {
      result.tags = args[i + 1].split(',').map(t => t.trim());
      i += 2;
    } else if (arg === '--thumbnail' && args[i + 1]) {
      result.thumbnail = args[i + 1];
      i += 2;
    } else if (arg === '--keep-urls') {
      result.keepUrls = true;
      i++;
    } else if (!arg.startsWith('--')) {
      if (!result.inputPath) {
        result.inputPath = arg;
      } else if (!result.templateId) {
        result.templateId = arg;
      }
      i++;
    } else {
      i++;
    }
  }

  return result;
}

// Download a file from URL
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await fs.writeFile(destPath, buffer);
          resolve(destPath);
        } catch (err) {
          reject(err);
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// Get file extension from URL or content type
function getExtension(url) {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath);
  if (ext) return ext;

  // Default extensions based on common patterns
  if (url.includes('video')) return '.mp4';
  return '.jpg';
}

// Helper: create a download entry and return the local path
function makeDownload(url, nodeId, suffix, templateId, assetsDir, field) {
  const ext = getExtension(url);
  const filename = `${nodeId}_${suffix}${ext}`;
  const localPath = `/templates/assets/${templateId}/${filename}`;
  const destPath = path.join(assetsDir, filename);
  return { url, destPath, localPath, field };
}

// Process a single node and download its assets
// When keepUrls is true, permanent cloud URLs are preserved instead of downloaded.
async function processNode(node, assetsDir, templateId, assetIndex, keepUrls) {
  const processedNode = JSON.parse(JSON.stringify(node));
  const downloads = [];
  let keptCount = 0;

  // --- General cleanup for all nodes ---
  delete processedNode.measured;
  delete processedNode.selected;
  delete processedNode.dragging;

  // Helper: schedule a download or keep the URL if it's permanent
  function handleUrl(url, nodeId, suffix, field) {
    if (keepUrls && isPermanentUrl(url)) {
      keptCount++;
      return null; // keep URL as-is
    }
    const dl = makeDownload(url, nodeId, suffix, templateId, assetsDir, field);
    downloads.push(dl);
    return dl.localPath;
  }

  // Process image generator nodes
  if (node.type === 'imageGenerator' && node.data) {
    const data = node.data;

    // Reset transient state
    processedNode.data.isGenerating = false;

    // Download referenceUrl
    if (data.referenceUrl && data.referenceUrl.startsWith('http')) {
      const localPath = handleUrl(data.referenceUrl, node.id, 'reference', 'referenceUrl');
      if (localPath) processedNode.data.referenceUrl = localPath;
    }

    // Download outputUrl
    if (data.outputUrl && data.outputUrl.startsWith('http')) {
      const localPath = handleUrl(data.outputUrl, node.id, 'output', 'outputUrl');
      if (localPath) processedNode.data.outputUrl = localPath;
    }

    // Download outputUrls array
    if (data.outputUrls && Array.isArray(data.outputUrls)) {
      processedNode.data.outputUrls = [];

      for (let i = 0; i < data.outputUrls.length; i++) {
        const url = data.outputUrls[i];
        if (url && url.startsWith('http')) {
          const localPath = handleUrl(url, node.id, `output_${i}`, `outputUrls[${i}]`);
          processedNode.data.outputUrls.push(localPath || url);
        } else {
          processedNode.data.outputUrls.push(url);
        }
      }
    }
  }

  // Process video generator nodes
  if (node.type === 'videoGenerator' && node.data) {
    const data = node.data;

    // Reset transient state
    processedNode.data.isGenerating = false;
    processedNode.data.progress = 0;

    if (data.outputUrl && data.outputUrl.startsWith('http')) {
      if (keepUrls && isPermanentUrl(data.outputUrl)) {
        keptCount++;
      } else {
        const ext = getExtension(data.outputUrl) || '.mp4';
        const filename = `${node.id}_output${ext}`;
        const localPath = `/templates/assets/${templateId}/${filename}`;
        const destPath = path.join(assetsDir, filename);

        downloads.push({
          url: data.outputUrl,
          destPath,
          localPath,
          field: 'outputUrl',
        });

        processedNode.data.outputUrl = localPath;
      }
    }

    if (data.thumbnailUrl && data.thumbnailUrl.startsWith('http')) {
      if (keepUrls && isPermanentUrl(data.thumbnailUrl)) {
        keptCount++;
      } else {
        const ext = getExtension(data.thumbnailUrl) || '.jpg';
        const filename = `${node.id}_thumbnail${ext}`;
        const localPath = `/templates/assets/${templateId}/${filename}`;
        const destPath = path.join(assetsDir, filename);

        downloads.push({
          url: data.thumbnailUrl,
          destPath,
          localPath,
          field: 'thumbnailUrl',
        });

        processedNode.data.thumbnailUrl = localPath;
      }
    }
  }

  // Process media nodes
  if (node.type === 'media' && node.data) {
    const data = node.data;

    if (data.url && data.url.startsWith('http')) {
      const localPath = handleUrl(data.url, node.id, 'media', 'url');
      if (localPath) processedNode.data.url = localPath;
    }
  }

  // Process storyboard nodes - clean up transient UI state
  if (node.type === 'storyboard' && node.data) {
    processedNode.data.chatPhase = 'draft-ready';
    processedNode.data.isGenerating = false;
  }

  // Process productShot nodes - clean up transient UI state
  if (node.type === 'productShot' && node.data) {
    processedNode.data.isGenerating = false;
  }

  // Process pluginNode nodes - download media URLs and output videos
  if (node.type === 'pluginNode' && node.data) {
    const state = processedNode.data.state;
    if (state) {
      // Download media dataUrl references in messages
      if (state.messages && Array.isArray(state.messages)) {
        for (const msg of state.messages) {
          if (msg.media && Array.isArray(msg.media)) {
            for (let i = 0; i < msg.media.length; i++) {
              const media = msg.media[i];
              if (media.dataUrl && media.dataUrl.startsWith('http')) {
                const localPath = handleUrl(media.dataUrl, node.id, `msg_media_${i}`, `messages.media[${i}].dataUrl`);
                if (localPath) media.dataUrl = localPath;
              }
            }
          }
        }
      }

      // Download media dataUrl references on the node-level media array
      if (processedNode.data.media && Array.isArray(processedNode.data.media)) {
        for (let i = 0; i < processedNode.data.media.length; i++) {
          const media = processedNode.data.media[i];
          if (media.dataUrl && media.dataUrl.startsWith('http')) {
            const localPath = handleUrl(media.dataUrl, node.id, `node_media_${i}`, `media[${i}].dataUrl`);
            if (localPath) media.dataUrl = localPath;
          }
        }
      }

      // Download output video URLs (versions, preview, output)
      if (state.versions && Array.isArray(state.versions)) {
        for (let i = 0; i < state.versions.length; i++) {
          const version = state.versions[i];
          if (version.videoUrl && version.videoUrl.startsWith('http')) {
            const cleanUrl = version.videoUrl.split('?')[0];
            if (keepUrls && isPermanentUrl(cleanUrl)) {
              keptCount++;
            } else {
              const dl = makeDownload(cleanUrl, node.id, `version_${i}`, templateId, assetsDir, `state.versions[${i}].videoUrl`);
              downloads.push(dl);
              version.videoUrl = dl.localPath;
            }
          }
        }
      }

      // Rewrite preview and output videoUrls to match the version local path
      // Only rewrite if the version was actually downloaded (not kept as cloud URL)
      if (state.preview && state.preview.videoUrl && state.preview.videoUrl.startsWith('http')) {
        if (keepUrls && isPermanentUrl(state.preview.videoUrl)) {
          // URL is permanent, keep as-is
        } else {
          const matchVersion = state.versions?.find(v => !v.videoUrl.startsWith('http'));
          if (matchVersion) {
            state.preview.videoUrl = matchVersion.videoUrl;
          }
        }
      }
      if (state.output && state.output.videoUrl && state.output.videoUrl.startsWith('http')) {
        if (keepUrls && isPermanentUrl(state.output.videoUrl)) {
          // URL is permanent, keep as-is
        } else {
          const matchVersion = state.versions?.find(v => !v.videoUrl.startsWith('http'));
          if (matchVersion) {
            state.output.videoUrl = matchVersion.videoUrl;
          }
        }
      }

      // Clear ephemeral sandbox URLs (E2B sandboxes expire)
      if (state.output && state.output.thumbnailUrl && state.output.thumbnailUrl.startsWith('/api/')) {
        state.output.thumbnailUrl = '';
      }
      if (state.sandboxId) {
        delete state.sandboxId;
      }
    }
  }

  return { processedNode, downloads, keptCount };
}

async function main() {
  const args = parseArgs();

  if (!args.inputPath || !args.templateId) {
    console.error('Usage: node scripts/create-showcase-template.mjs <exported-json-path> <template-id> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --name         Template display name');
    console.error('  --description  Template description');
    console.error('  --tags         Comma-separated tags (featured,branding,photography,etc)');
    console.error('  --thumbnail    Path to thumbnail image');
    console.error('  --keep-urls    Keep permanent cloud URLs (R2/S3) instead of downloading.');
    console.error('                 Auto-detected when ASSET_STORAGE, R2_PUBLIC_URL, or');
    console.error('                 S3_PUBLIC_URL env vars are set.');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/create-showcase-template.mjs ./my-export.json product-variations --name "Product Variations" --description "Create variations" --tags "featured,branding"');
    process.exit(1);
  }

  const { inputPath, templateId, name, description, tags, thumbnail } = args;

  // Determine whether to keep cloud URLs
  const keepUrls = args.keepUrls || shouldKeepUrls();
  if (keepUrls) {
    console.log('\nCloud storage detected — permanent URLs will be preserved.');
    if (args.keepUrls) console.log('  (forced via --keep-urls flag)');
    else console.log(`  (auto-detected from env: ASSET_STORAGE=${process.env.ASSET_STORAGE || ''}, R2_PUBLIC_URL=${process.env.R2_PUBLIC_URL ? '***' : ''}, S3_PUBLIC_URL=${process.env.S3_PUBLIC_URL ? '***' : ''})`);
  }

  console.log(`\nCreating showcase template: ${templateId}`);
  console.log('='.repeat(50));

  // Read input JSON
  console.log(`\nReading exported canvas from: ${inputPath}`);
  const inputJson = await fs.readFile(inputPath, 'utf-8');
  const exportedData = JSON.parse(inputJson);

  // Handle both direct export format and wrapped format
  const nodes = exportedData.nodes || [];
  const edges = exportedData.edges || [];

  console.log(`Found ${nodes.length} nodes and ${edges.length} edges`);

  // Process all nodes and collect downloads
  const assetsDir = path.join(projectRoot, 'public', 'templates', 'assets', templateId);
  const processedNodes = [];
  const allDownloads = [];
  let totalKept = 0;

  for (const node of nodes) {
    const { processedNode, downloads, keptCount } = await processNode(node, assetsDir, templateId, allDownloads.length, keepUrls);
    processedNodes.push(processedNode);
    allDownloads.push(...downloads);
    totalKept += keptCount;
  }

  // Only create assets directory if there are actual downloads
  if (allDownloads.length > 0) {
    await fs.mkdir(assetsDir, { recursive: true });
    console.log(`\nDownloading ${allDownloads.length} assets...`);

    for (const download of allDownloads) {
      try {
        console.log(`  Downloading: ${download.field} -> ${path.basename(download.destPath)}`);
        await downloadFile(download.url, download.destPath);
        console.log(`    ✓ Saved to ${download.localPath}`);
      } catch (error) {
        console.error(`    ✗ Failed to download: ${error.message}`);
        // Keep the original URL if download fails
      }
    }
  } else {
    console.log('\nNo assets to download.');
  }

  if (totalKept > 0) {
    console.log(`\nKept ${totalKept} permanent cloud URL(s) as-is.`);
  }

  // Copy thumbnail if provided
  let thumbnailPath = `/templates/${templateId}.jpg`;
  if (thumbnail) {
    const thumbnailDest = path.join(projectRoot, 'public', 'templates', `${templateId}.jpg`);
    await fs.copyFile(thumbnail, thumbnailDest);
    console.log(`\nCopied thumbnail to: ${thumbnailDest}`);
  }

  // Create template JSON
  const template = {
    id: templateId,
    name: name || templateId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: description || `${name || templateId} showcase template`,
    thumbnail: thumbnailPath,
    category: 'showcase',
    readOnly: true,
    tags: tags.length > 0 ? tags : ['featured'],
    nodes: processedNodes,
    edges: edges.map(e => {
      const cleaned = { ...e };
      delete cleaned.selected;
      return cleaned;
    }),
  };

  // Save template JSON
  const templateJsonPath = path.join(projectRoot, 'public', 'templates', `${templateId}.json`);
  await fs.writeFile(templateJsonPath, JSON.stringify(template, null, 2));
  console.log(`\nSaved template JSON to: ${templateJsonPath}`);

  console.log('\n' + '='.repeat(50));
  console.log('Template created successfully!');
  console.log('\nNext steps:');
  console.log(`  1. Add a thumbnail image at: public/templates/${templateId}.jpg`);
  console.log(`  2. The template will be loaded automatically from: ${templateJsonPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
