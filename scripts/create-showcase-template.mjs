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
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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

// Process a single node and download its assets
async function processNode(node, assetsDir, templateId, assetIndex) {
  const processedNode = JSON.parse(JSON.stringify(node));
  const downloads = [];

  // Process image generator nodes
  if (node.type === 'imageGenerator' && node.data) {
    const data = node.data;

    // Download outputUrl
    if (data.outputUrl && data.outputUrl.startsWith('http')) {
      const ext = getExtension(data.outputUrl);
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

    // Download outputUrls array
    if (data.outputUrls && Array.isArray(data.outputUrls)) {
      processedNode.data.outputUrls = [];

      for (let i = 0; i < data.outputUrls.length; i++) {
        const url = data.outputUrls[i];
        if (url && url.startsWith('http')) {
          const ext = getExtension(url);
          const filename = `${node.id}_output_${i}${ext}`;
          const localPath = `/templates/assets/${templateId}/${filename}`;
          const destPath = path.join(assetsDir, filename);

          downloads.push({
            url,
            destPath,
            localPath,
            field: `outputUrls[${i}]`,
          });

          processedNode.data.outputUrls.push(localPath);
        } else {
          processedNode.data.outputUrls.push(url);
        }
      }
    }
  }

  // Process video generator nodes
  if (node.type === 'videoGenerator' && node.data) {
    const data = node.data;

    if (data.outputUrl && data.outputUrl.startsWith('http')) {
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

    if (data.thumbnailUrl && data.thumbnailUrl.startsWith('http')) {
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

  // Process media nodes
  if (node.type === 'media' && node.data) {
    const data = node.data;

    if (data.url && data.url.startsWith('http')) {
      const ext = getExtension(data.url);
      const filename = `${node.id}_media${ext}`;
      const localPath = `/templates/assets/${templateId}/${filename}`;
      const destPath = path.join(assetsDir, filename);

      downloads.push({
        url: data.url,
        destPath,
        localPath,
        field: 'url',
      });

      processedNode.data.url = localPath;
    }
  }

  return { processedNode, downloads };
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
    console.error('');
    console.error('Example:');
    console.error('  node scripts/create-showcase-template.mjs ./my-export.json product-variations --name "Product Variations" --description "Create variations" --tags "featured,branding"');
    process.exit(1);
  }

  const { inputPath, templateId, name, description, tags, thumbnail } = args;

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

  // Create assets directory
  const assetsDir = path.join(projectRoot, 'public', 'templates', 'assets', templateId);
  await fs.mkdir(assetsDir, { recursive: true });
  console.log(`Created assets directory: ${assetsDir}`);

  // Process all nodes and collect downloads
  const processedNodes = [];
  const allDownloads = [];

  for (const node of nodes) {
    const { processedNode, downloads } = await processNode(node, assetsDir, templateId, allDownloads.length);
    processedNodes.push(processedNode);
    allDownloads.push(...downloads);
  }

  // Download all assets
  if (allDownloads.length > 0) {
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
    console.log('\nNo remote assets to download.');
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
    edges: edges,
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
