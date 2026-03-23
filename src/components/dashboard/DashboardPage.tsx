'use client';

import { Loader2 } from 'lucide-react';
import { useDashboardState } from './hooks/useDashboardState';
import { DashboardHeader } from './DashboardHeader';
import { DashboardTabs } from './DashboardTabs';
import { ProjectsGrid } from './ProjectsGrid';
import { TemplatesSection } from './TemplatesSection';
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
    loadErrorTitle,
    retryActionLabel,
    personalCanvases,
    teamCanvases,
    invites,
    memberships,
    filteredTemplates,
    handleCreateCanvas,
    handleSelectTemplate,
    handleRemixTemplate,
    handleRename,
    handleDuplicate,
    handleDelete,
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
      <div className="mx-auto w-full max-w-[1680px] px-5 py-6 md:px-7 md:py-8">
        <DashboardHeader onCreateCanvas={handleCreateCanvas} memberships={memberships} />

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* Content based on active tab */}
        {activeTab === 'my-spaces' && (
          <>
            <section className="mb-12 space-y-10">
              <div>
                <h2 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">Personal</h2>
                <p className="mb-5 text-sm text-muted-foreground">Your private workspace projects.</p>
                <ProjectsGrid
                  canvases={personalCanvases}
                  isLoading={isLoadingList}
                  loadError={loadError}
                  loadErrorTitle={loadErrorTitle}
                  searchQuery={searchQuery}
                  onCreateCanvas={handleCreateCanvas}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}

                  onRetryLoad={retryLoadCanvases}
                  retryLabel={retryActionLabel}
                  onBrowseTemplates={() => setActiveTab('templates')}
                />
              </div>

              {teamCanvases.length > 0 && (
                <div>
                  <h2 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">Team</h2>
                  <p className="mb-5 text-sm text-muted-foreground">Collaborative team workspaces.</p>
                  <ProjectsGrid
                    canvases={teamCanvases}
                    isLoading={isLoadingList}
                    loadError={null}
                    searchQuery={searchQuery}
                    onCreateCanvas={handleCreateCanvas}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
  
                    onRetryLoad={retryLoadCanvases}
                    onBrowseTemplates={() => setActiveTab('templates')}
                  />
                </div>
              )}
            </section>

            {invites.length > 0 && (
              <section className="mb-12 rounded-2xl border border-border/70 bg-card/60 p-4 md:p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Invite status</h3>
                <div className="space-y-2 text-sm">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <span className="text-muted-foreground">{invite.email}</span>
                      <span className="text-foreground capitalize">{invite.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Showcase preview on My Spaces tab */}
            <TemplatesSection
              templates={filteredTemplates}
              onSelectTemplate={handleSelectTemplate}
              onRemixTemplate={handleRemixTemplate}
              showViewAll
              onViewAll={() => setActiveTab('templates')}
            />
          </>
        )}

{/* TODO: Shared tab hidden until sharing is implemented */}
        {activeTab === 'templates' && (
          <TemplatesSection
            templates={filteredTemplates}
            onSelectTemplate={handleSelectTemplate}
            onRemixTemplate={handleRemixTemplate}
          />
        )}
      </div>
    </PageTransition>
  );
}
