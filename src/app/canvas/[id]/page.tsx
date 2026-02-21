'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/components/canvas/Canvas';
import { AppShell } from '@/components/layout';
import { useAppStore } from '@/stores/app-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { Loader2 } from 'lucide-react';
import { exportAsJSON, exportAsPNG } from '@/lib/export-utils';
import { toast } from 'sonner';

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

export default function CanvasPage({ params }: CanvasPageProps) {
  const { id } = use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCanvas = useAppStore((state) => state.loadCanvas);
  const currentCanvasName = useAppStore((state) => state.currentCanvasName);
  const setCurrentCanvasName = useAppStore((state) => state.setCurrentCanvasName);
  const isSaving = useAppStore((state) => state.isSaving);
  const hasUnsavedChanges = useAppStore((state) => state.hasUnsavedChanges);
  const lastSavedAt = useAppStore((state) => state.lastSavedAt);

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const success = await loadCanvas(id);
        if (!success) {
          setError('Canvas not found');
        }
      } catch (err) {
        console.error('Failed to load canvas:', err);
        setError('Failed to load canvas');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [id, loadCanvas]);

  const handleExportJSON = useCallback(() => {
    try {
      exportAsJSON(nodes, edges, currentCanvasName);
      toast.success('Workflow exported as JSON');
    } catch {
      toast.error('Failed to export workflow');
    }
  }, [nodes, edges, currentCanvasName]);

  const handleExportPNG = useCallback(async () => {
    try {
      const canvasElement = document.querySelector('.react-flow') as HTMLElement;
      if (canvasElement) {
        await exportAsPNG(canvasElement, currentCanvasName);
        toast.success('Canvas exported as PNG');
      }
    } catch {
      toast.error('Failed to export as PNG');
    }
  }, [currentCanvasName]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading canvas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">🖼️</div>
            <h1 className="font-serif text-xl font-normal text-foreground">{error}</h1>
            <p className="text-muted-foreground">
              The canvas you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Link
              href="/"
              className="mt-4 px-4 py-2 bg-gradient-to-r from-[var(--accent-amber)] to-[var(--accent-pink)] text-white rounded-lg transition-opacity hover:opacity-90"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <AppShell
        mode="canvas"
        canvasName={currentCanvasName}
        onCanvasNameChange={setCurrentCanvasName}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        onExportJSON={handleExportJSON}
        onExportPNG={handleExportPNG}
        showSidebar={false}
      >
        <Canvas />
      </AppShell>
      {/* FAB removed - AI slop */}
    </ReactFlowProvider>
  );
}
