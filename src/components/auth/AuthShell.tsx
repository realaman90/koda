'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { KodaLogo } from '@/components/ui/KodaLogo';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background min-h-screen min-h-dvh grid place-items-center px-4 py-4 sm:px-6">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card text-card-foreground border-border w-full rounded-xl border p-5 shadow-sm sm:p-6">
      {children}
    </section>
  );
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-3 text-center">
      <div className="flex justify-center">
        <KodaLogo variant="full" size="sm" priority />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}

export function DividerWithLabel({ label }: { label: string }) {
  return (
    <div className="relative py-1" aria-hidden>
      <div className="border-border border-t" />
      <span className="bg-card text-muted-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
        {label}
      </span>
    </div>
  );
}

export function AuthFooterLinks({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{' '}
      <Link
        href={href}
        className="text-[var(--accent-primary)] underline-offset-4 transition-colors hover:text-[var(--accent-primary-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))]"
      >
        {label}
      </Link>
    </p>
  );
}

export function InlineFeedbackArea({
  message,
  type = 'error',
}: {
  message?: string;
  type?: 'error' | 'info';
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        type === 'error'
          ? 'border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]'
          : 'border-border bg-muted text-foreground'
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M23.766 12.276c0-.816-.066-1.636-.21-2.438H12.24v4.62h6.48a5.54 5.54 0 0 1-2.4 3.638v3.002h3.87c2.272-2.092 3.576-5.182 3.576-8.822Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 24c3.236 0 5.964-1.062 7.95-2.904l-3.87-3.002c-1.076.732-2.464 1.148-4.08 1.148-3.13 0-5.782-2.112-6.73-4.952H1.52v3.096A12.004 12.004 0 0 0 12.24 24Z"
        fill="#34A853"
      />
      <path
        d="M5.51 14.29A7.208 7.208 0 0 1 5.134 12c0-.794.14-1.566.376-2.29V6.614H1.52A12.036 12.036 0 0 0 0 12c0 1.932.462 3.758 1.52 5.386l3.99-3.096Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 4.758c1.704 0 3.23.586 4.434 1.734l3.302-3.302C18.198 1.534 15.47 0 12.24 0A12.004 12.004 0 0 0 1.52 6.614L5.51 9.71c.948-2.84 3.6-4.952 6.73-4.952Z"
        fill="#EA4335"
      />
    </svg>
  );
}
