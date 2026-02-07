/**
 * Player Entry Point
 *
 * Mounts the standalone Remotion Player for iframe embedding.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { RemotionPlayer } from './Player';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <RemotionPlayer />
    </React.StrictMode>
  );
}
