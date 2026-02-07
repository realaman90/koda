/**
 * Configuration Status API
 * 
 * GET /api/config - Returns current storage configuration
 * 
 * Useful for debugging and displaying in settings UI.
 */

import { NextResponse } from 'next/server';
import { getStorageConfig, getConfigSummary } from '@/lib/config';

export async function GET() {
  try {
    const config = getStorageConfig();
    const summary = getConfigSummary();
    
    return NextResponse.json({
      success: true,
      config,
      summary,
      // Also return individual flags for easy checking
      flags: {
        isSelfHosted: !config.canvas.isCloud && !config.assets.isCloud,
        isCloud: config.canvas.isCloud && config.assets.isCloud && config.assets.isConfigured,
        hasLocalDb: config.canvas.backend === 'local-file',
        hasCloudDb: config.canvas.backend === 'turso',
        hasLocalAssets: config.assets.type === 'local',
        hasCloudAssets: config.assets.type === 'r2' || config.assets.type === 's3',
        assetsConfigured: config.assets.isConfigured,
      },
    });
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}
