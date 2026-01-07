'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/components/canvas/Canvas';
import { Header } from '@/components/layout/Header';

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex-1">
          <Canvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
