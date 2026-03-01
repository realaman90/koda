'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/components/canvas/Canvas';
import { AppShell } from '@/components/layout';
import { RemixBanner } from '@/components/template/RemixBanner';
import { useAppStore } from '@/stores/app-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { getTemplate, getShowcaseTemplate } from '@/lib/templates';
import type { Template } from '@/lib/templates/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TemplatePageProps {
  params: Promise<{ id: string }>;
}

export default function TemplatePage({ params }: TemplatePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [isRemixing, setIsRemixing] = useState(false);

  const loadAsReadOnly = useCanvasStore((state) => state.loadAsReadOnly);
  const loadCanvasData = useCanvasStore((state) => state.loadCanvasData);
  const clearCurrentCanvas = useAppStore((state) => state.clearCurrentCanvas);
  const createCanvasFromTemplate = useAppStore((state) => state.createCanvasFromTemplate);

  // Load template and set canvas to read-only
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        let tmpl = getTemplate(id);
        if (!tmpl) {
          tmpl = await getShowcaseTemplate(id);
        }
        if (!tmpl) {
          setError('Template not found');
          return;
        }

        setTemplate(tmpl);
        // Ensure preview mode never mutates or auto-saves into a project
        clearCurrentCanvas();
        loadAsReadOnly(tmpl.nodes, tmpl.edges);
      } catch (err) {
        console.error('Failed to load template:', err);
        setError('Failed to load template');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [id, clearCurrentCanvas, loadAsReadOnly]);

  // Cleanup on unmount: clear read-only state
  useEffect(() => {
    return () => {
      loadCanvasData([], []);
    };
  }, [loadCanvasData]);

  const handleRemix = useCallback(async () => {
    if (!template) return;
    setIsRemixing(true);
    try {
      const canvasId = await createCanvasFromTemplate(template);
      router.push(`/canvas/${canvasId}`);
    } catch {
      toast.error('Failed to remix template');
      setIsRemixing(false);
    }
  }, [template, createCanvasFromTemplate, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">🖼️</div>
            <h1 className="font-serif text-xl font-normal text-foreground">
              {error || 'Template not found'}
            </h1>
            <p className="text-muted-foreground">
              The template you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
              href="/"
              className="mt-4 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg transition-colors"
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
        canvasName={template.name}
        showSidebar={false}
      >
        <RemixBanner
          templateName={template.name}
          onRemix={handleRemix}
          isRemixing={isRemixing}
        />
        <div className="h-full">
          <Canvas />
        </div>
      </AppShell>
    </ReactFlowProvider>
  );
}
