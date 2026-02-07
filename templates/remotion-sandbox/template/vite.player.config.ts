/**
 * Vite config for standalone Remotion Player
 *
 * This serves the player.html page with the Remotion Player component.
 * Used for iframe preview without the full Remotion Studio.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
  },
  build: {
    outDir: 'dist-player',
  },
  // Use player.html as the entry point
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
