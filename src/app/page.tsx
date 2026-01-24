'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/layout';
import { DashboardPage } from '@/components/dashboard';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  return (
    <AppShell mode="dashboard">
      <DashboardPage />
    </AppShell>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
