'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import { getTemplateList, getTemplate, getShowcaseTemplateMetadata, getShowcaseTemplate } from '@/lib/templates';
import type { TemplateMetadata } from '@/lib/templates/types';

export type TabType = 'my-spaces' | 'shared' | 'templates';
export type TemplateFilter = 'all' | 'featured' | 'workflow' | 'creative' | 'starter';

const validTabs: TabType[] = ['my-spaces', 'shared', 'templates'];

export interface DashboardState {
  // State
  isCreating: boolean;
  activeTab: TabType;
  templateFilter: TemplateFilter;
  searchQuery: string;
  isLoadingList: boolean;
  filteredCanvases: ReturnType<typeof useAppStore.getState>['canvasList'];
  filteredTemplates: TemplateMetadata[];
  templates: TemplateMetadata[];

  // Actions
  setActiveTab: (tab: TabType) => void;
  setTemplateFilter: (filter: TemplateFilter) => void;
  setSearchQuery: (query: string) => void;
  handleCreateCanvas: () => Promise<void>;
  handleSelectTemplate: (templateId: string) => Promise<void>;
  handleRename: (id: string, name: string) => Promise<void>;
  handleDuplicate: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

export function useDashboardState(): DashboardState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Read tab from URL params
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = tabParam && validTabs.includes(tabParam as TabType)
    ? (tabParam as TabType)
    : 'my-spaces';

  // Update URL when tab changes
  const setActiveTab = useCallback((tab: TabType) => {
    if (tab === 'my-spaces') {
      router.push('/');
    } else {
      router.push(`/?tab=${tab}`);
    }
  }, [router]);

  const canvasList = useAppStore((state) => state.canvasList);
  const isLoadingList = useAppStore((state) => state.isLoadingList);
  const loadCanvasList = useAppStore((state) => state.loadCanvasList);
  const createCanvas = useAppStore((state) => state.createCanvas);
  const createCanvasFromTemplate = useAppStore((state) => state.createCanvasFromTemplate);
  const renameCanvas = useAppStore((state) => state.renameCanvas);
  const duplicateCanvas = useAppStore((state) => state.duplicateCanvas);
  const deleteCanvas = useAppStore((state) => state.deleteCanvas);
  const migrateLegacyData = useAppStore((state) => state.migrateLegacyData);
  const initializeSync = useAppStore((state) => state.initializeSync);

  const builtInTemplates = getTemplateList();
  const [showcaseTemplates, setShowcaseTemplates] = useState<TemplateMetadata[]>([]);

  // Load showcase templates asynchronously (JSON files from /public/templates/)
  useEffect(() => {
    getShowcaseTemplateMetadata().then(setShowcaseTemplates).catch(() => {});
  }, []);

  // Place showcase templates after the first card (blank)
  const templates = [builtInTemplates[0], ...showcaseTemplates, ...builtInTemplates.slice(1)];

  // Filter templates based on selected filter
  const filteredTemplates = templates.filter((t) => {
    if (templateFilter === 'all') return true;
    if (templateFilter === 'featured') return true; // Show all as featured for now
    return t.category === templateFilter;
  });

  // Filter canvases based on search
  const filteredCanvases = canvasList.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    async function init() {
      // Initialize sync with SQLite (if configured)
      await initializeSync();

      // Migrate legacy localStorage data
      const migratedId = await migrateLegacyData();
      if (migratedId) {
        toast.success('Migrated your existing canvas');
      }
      
      await loadCanvasList();
    }
    init();
  }, [loadCanvasList, migrateLegacyData, initializeSync]);

  const handleCreateCanvas = useCallback(async () => {
    setIsCreating(true);
    try {
      const id = await createCanvas();
      router.push(`/canvas/${id}`);
    } catch {
      toast.error('Failed to create canvas');
      setIsCreating(false);
    }
  }, [createCanvas, router]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    setIsCreating(true);
    try {
      // Check built-in templates first, then showcase templates
      let template = getTemplate(templateId);
      if (!template) {
        template = await getShowcaseTemplate(templateId);
      }
      if (!template) {
        toast.error('Template not found');
        setIsCreating(false);
        return;
      }

      if (templateId === 'blank') {
        const id = await createCanvas('Untitled Canvas');
        router.push(`/canvas/${id}`);
      } else {
        const id = await createCanvasFromTemplate(template);
        router.push(`/canvas/${id}`);
      }
    } catch {
      toast.error('Failed to create canvas from template');
      setIsCreating(false);
    }
  }, [createCanvas, createCanvasFromTemplate, router]);

  const handleRename = useCallback(async (id: string, name: string) => {
    try {
      await renameCanvas(id, name);
      toast.success('Canvas renamed');
    } catch {
      toast.error('Failed to rename canvas');
    }
  }, [renameCanvas]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const newId = await duplicateCanvas(id);
      if (newId) {
        toast.success('Canvas duplicated');
      }
    } catch {
      toast.error('Failed to duplicate canvas');
    }
  }, [duplicateCanvas]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteCanvas(id);
      toast.success('Canvas deleted');
    } catch {
      toast.error('Failed to delete canvas');
    }
  }, [deleteCanvas]);

  return {
    isCreating,
    activeTab,
    templateFilter,
    searchQuery,
    isLoadingList,
    filteredCanvases,
    filteredTemplates,
    templates,
    setActiveTab,
    setTemplateFilter,
    setSearchQuery,
    handleCreateCanvas,
    handleSelectTemplate,
    handleRename,
    handleDuplicate,
    handleDelete,
  };
}
