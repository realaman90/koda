'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/layout';
import { SettingsContent } from '@/components/settings/SettingsContent';
import { Loader2 } from 'lucide-react';

function SettingsPage() {
  return (
    <AppShell mode="dashboard" breadcrumbs={[{ label: 'Settings' }]}>
      <SettingsContent />
    </AppShell>
  );
}

export default function Settings() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsPage />
    </Suspense>
  );
}
