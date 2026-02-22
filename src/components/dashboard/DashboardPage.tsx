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
    personalCanvases,
    teamCanvases,
    sharedCanvases,
    invites,
    memberships,
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
        <DashboardHeader onCreateCanvas={handleCreateCanvas} memberships={memberships} />

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* Content based on active tab */}
        {activeTab === 'my-spaces' && (
          <>
            <section className="mb-12 space-y-10">
              <div>
                <h2 className="font-serif text-2xl font-normal text-foreground mb-2">Personal</h2>
                <p className="text-sm text-muted-foreground mb-4">Your private workspace projects.</p>
                <ProjectsGrid
                  canvases={personalCanvases}
                  isLoading={isLoadingList}
                  loadError={loadError}
                  searchQuery={searchQuery}
                  onCreateCanvas={handleCreateCanvas}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onRefreshPreview={handleRefreshPreview}
                  onRetryLoad={retryLoadCanvases}
                  onBrowseTemplates={() => setActiveTab('templates')}
                />
              </div>

              <div>
                <h2 className="font-serif text-2xl font-normal text-foreground mb-2">Team</h2>
                <p className="text-sm text-muted-foreground mb-4">Collaborative team workspaces.</p>
                <ProjectsGrid
                  canvases={teamCanvases}
                  isLoading={isLoadingList}
                  loadError={null}
                  searchQuery={searchQuery}
                  onCreateCanvas={handleCreateCanvas}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onRefreshPreview={handleRefreshPreview}
                  onRetryLoad={retryLoadCanvases}
                  onBrowseTemplates={() => setActiveTab('templates')}
                />
              </div>
            </section>

            {invites.length > 0 && (
              <section className="mb-12 rounded-xl border border-border bg-card/50 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Invite status</h3>
                <div className="space-y-2 text-sm">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2">
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
              showViewAll
              onViewAll={() => setActiveTab('templates')}
            />
          </>
        )}

        {activeTab === 'shared' && <SharedSection canvases={sharedCanvases} onRename={handleRename} onDuplicate={handleDuplicate} onDelete={handleDelete} onRefreshPreview={handleRefreshPreview} onCreateCanvas={handleCreateCanvas} />}
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
