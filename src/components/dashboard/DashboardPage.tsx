'use client';

import { Loader2 } from 'lucide-react';
import { useDashboardState } from './hooks/useDashboardState';
import { DashboardHeader } from './DashboardHeader';
import { DashboardTabs } from './DashboardTabs';
import { ProjectsGrid } from './ProjectsGrid';
import { TemplatesSection } from './TemplatesSection';
import { SharedSection } from './SharedSection';
import { PageTransition } from '@/components/common/PageTransition';

export function DashboardPage() {
  const {
    isCreating,
    activeTab,
    setActiveTab,
    searchQuery,
    isLoadingList,
    retryLoadCanvases,
    loadError,
    filteredCanvases,
    filteredTemplates,
    handleCreateCanvas,
    handleSelectTemplate,
    handleRename,
    handleDuplicate,
    handleDelete,
    handleRefreshPreview,
  } = useDashboardState();

  if (isCreating) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Creating canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <DashboardHeader onCreateCanvas={handleCreateCanvas} />

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* Content based on active tab */}
        {activeTab === 'my-spaces' && (
          <>
            <section className="mb-12">
              <h2 className="font-serif text-2xl font-normal text-foreground mb-4">Your projects</h2>
              <ProjectsGrid
                canvases={filteredCanvases}
                isLoading={isLoadingList}
                loadError={loadError}
                searchQuery={searchQuery}
                onCreateCanvas={handleCreateCanvas}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onRefreshPreview={handleRefreshPreview}
                onRetryLoad={retryLoadCanvases}
              />
            </section>

            {/* Showcase preview on My Spaces tab */}
            <TemplatesSection
              templates={filteredTemplates}
              onSelectTemplate={handleSelectTemplate}
              showViewAll
              onViewAll={() => setActiveTab('templates')}
            />
          </>
        )}

        {activeTab === 'shared' && <SharedSection />}

        {activeTab === 'templates' && (
          <TemplatesSection
            templates={filteredTemplates}
            onSelectTemplate={handleSelectTemplate}
          />
        )}
      </div>
    </PageTransition>
  );
}
