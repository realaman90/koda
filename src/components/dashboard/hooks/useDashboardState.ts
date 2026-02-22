'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import { getTemplate, getShowcaseTemplateMetadata, getShowcaseTemplate } from '@/lib/templates';
import type { TemplateMetadata } from '@/lib/templates/types';

export type TabType = 'my-spaces' | 'shared' | 'templates';
export type TemplateFilter = 'all';

const validTabs: TabType[] = ['my-spaces', 'shared', 'templates'];

type DashboardLoadFailureStage = 'bootstrap' | 'canvases' | null;

export interface DashboardState {
  // State
  isCreating: boolean;
  activeTab: TabType;
  searchQuery: string;
  isLoadingList: boolean;
  loadError: string | null;
  loadErrorTitle: string;
  retryActionLabel: string;
  filteredCanvases: ReturnType<typeof useAppStore.getState>['canvasList'];
  personalCanvases: ReturnType<typeof useAppStore.getState>['canvasList'];
  teamCanvases: ReturnType<typeof useAppStore.getState>['canvasList'];
  sharedCanvases: ReturnType<typeof useAppStore.getState>['canvasList'];
  invites: Array<{ id: string; status: string; email: string; role: string }>;
  memberships: Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>;
  filteredTemplates: TemplateMetadata[];
  templates: TemplateMetadata[];

  // Actions
  setActiveTab: (tab: TabType) => void;
  setSearchQuery: (query: string) => void;
  retryLoadCanvases: () => Promise<void>;
  handleCreateCanvas: () => Promise<void>;
  handleSelectTemplate: (templateId: string) => Promise<void>;
  handleRename: (id: string, name: string) => Promise<void>;
  handleDuplicate: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleRefreshPreview: (id: string) => Promise<void>;
}

export function useDashboardState(): DashboardState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorTitle, setLoadErrorTitle] = useState('Couldn’t load your projects');
  const [loadFailureStage, setLoadFailureStage] = useState<DashboardLoadFailureStage>(null);
  const bootstrapAttemptRef = useRef(0);

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
  const requestPreviewRefresh = useAppStore((state) => state.requestPreviewRefresh);
  const migrateLegacyData = useAppStore((state) => state.migrateLegacyData);
  const initializeSync = useAppStore((state) => state.initializeSync);

  const [showcaseTemplates, setShowcaseTemplates] = useState<TemplateMetadata[]>([]);
  const [invites, setInvites] = useState<Array<{ id: string; status: string; email: string; role: string }>>([]);
  const [memberships, setMemberships] = useState<Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>>([]);

  // Load showcase templates asynchronously (JSON files from /public/templates/)
  useEffect(() => {
    getShowcaseTemplateMetadata().then(setShowcaseTemplates).catch(() => {});
  }, []);

  const templates = showcaseTemplates;
  const filteredTemplates = templates;

  // Filter canvases based on search
  const filteredCanvases = canvasList.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const personalCanvases = filteredCanvases.filter((canvas) => canvas.workspaceType !== 'team');
  const teamCanvases = filteredCanvases.filter((canvas) => canvas.workspaceType === 'team' && !canvas.isShared);
  const sharedCanvases = filteredCanvases.filter((canvas) => canvas.isShared);

  const clearLoadError = useCallback(() => {
    setLoadError(null);
    setLoadErrorTitle('Couldn’t load your projects');
    setLoadFailureStage(null);
  }, []);

  const loadCanvasesWithHandling = useCallback(async () => {
    try {
      await loadCanvasList();
      clearLoadError();
      return true;
    } catch (error) {
      setLoadFailureStage('canvases');
      setLoadErrorTitle('Couldn’t load your projects');
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [clearLoadError, loadCanvasList]);

  const runWorkspaceBootstrap = useCallback(async () => {
    bootstrapAttemptRef.current += 1;

    const response = await fetch('/api/workspaces/bootstrap', {
      method: 'POST',
      headers: {
        'x-workspace-bootstrap-attempt': String(bootstrapAttemptRef.current),
      },
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // no-op, fallback message is used below
    }

    if (!response.ok) {
      let errorMessage = 'Failed to initialize workspace.';
      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string' &&
        payload.error.trim()
      ) {
        errorMessage = payload.error;
      }

      setLoadFailureStage('bootstrap');
      setLoadErrorTitle('Workspace setup failed');
      setLoadError(errorMessage);
      toast.error(`Workspace setup failed: ${errorMessage}`);
      return false;
    }

    if (payload && typeof payload === 'object') {
      const bootstrap = payload as {
        invites?: Array<{ id: string; status: string; email: string; role: string }>;
        memberships?: Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>;
      };
      setInvites(bootstrap.invites || []);
      setMemberships(bootstrap.memberships || []);
    } else {
      setInvites([]);
      setMemberships([]);
    }

    return true;
  }, []);

  const initializeDashboard = useCallback(async (options?: { runSetup?: boolean }) => {
    clearLoadError();

    try {
      if (options?.runSetup !== false) {
        // Initialize sync with SQLite (if configured)
        await initializeSync();

        // Migrate legacy localStorage data
        const migratedId = await migrateLegacyData();
        if (migratedId) {
          toast.success('Migrated your existing canvas');
        }
      }

      const bootstrapped = await runWorkspaceBootstrap();
      if (!bootstrapped) {
        return;
      }

      await loadCanvasesWithHandling();
    } catch (error) {
      setLoadFailureStage('canvases');
      setLoadErrorTitle('Couldn’t load your projects');
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [clearLoadError, initializeSync, loadCanvasesWithHandling, migrateLegacyData, runWorkspaceBootstrap]);

  const retryLoadCanvases = useCallback(async () => {
    if (loadFailureStage === 'bootstrap') {
      await initializeDashboard({ runSetup: false });
      return;
    }

    clearLoadError();
    await loadCanvasesWithHandling();
  }, [clearLoadError, initializeDashboard, loadCanvasesWithHandling, loadFailureStage]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  const retryActionLabel = loadFailureStage === 'bootstrap'
    ? 'Retry workspace setup'
    : 'Retry loading projects';

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

  const handleRefreshPreview = useCallback(async (id: string) => {
    try {
      await requestPreviewRefresh(id, true);
      toast.success('Refreshing preview…');
    } catch {
      toast.error('Failed to refresh preview');
    }
  }, [requestPreviewRefresh]);

  return {
    isCreating,
    activeTab,
    searchQuery,
    isLoadingList,
    loadError,
    loadErrorTitle,
    retryActionLabel,
    filteredCanvases,
    personalCanvases,
    teamCanvases,
    sharedCanvases,
    invites,
    memberships,
    filteredTemplates,
    templates,
    setActiveTab,
    setSearchQuery,
    retryLoadCanvases,
    handleCreateCanvas,
    handleSelectTemplate,
    handleRename,
    handleDuplicate,
    handleDelete,
    handleRefreshPreview,
  };
}
