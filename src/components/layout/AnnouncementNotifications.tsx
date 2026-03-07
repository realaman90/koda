'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getAnnouncementsForMode,
  type AnnouncementMode,
  type AnnouncementTone,
} from '@/lib/announcements';

const DISMISSED_STORAGE_KEY = 'koda:dismissed-announcements';

const TONE_STYLES: Record<AnnouncementTone, string> = {
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-50',
  highlight: 'border-violet-500/25 bg-gradient-to-br from-violet-500/16 via-fuchsia-500/10 to-cyan-500/12 text-white',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
};

const BADGE_STYLES: Record<AnnouncementTone, string> = {
  info: 'border-sky-400/25 bg-sky-400/15 text-sky-100',
  highlight: 'border-white/15 bg-white/12 text-white',
  success: 'border-emerald-400/25 bg-emerald-400/15 text-emerald-50',
};

interface AnnouncementNotificationsProps {
  mode: AnnouncementMode;
}

export function AnnouncementNotifications({ mode }: AnnouncementNotificationsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      setDismissedIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
    } catch {
      setDismissedIds([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  const announcements = useMemo(() => {
    const active = getAnnouncementsForMode(mode);
    if (!hydrated) return [];
    return active.filter((announcement) => !dismissedIds.includes(announcement.id));
  }, [dismissedIds, hydrated, mode]);

  const dismissAnnouncement = (id: string) => {
    setDismissedIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  if (!announcements.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-16 z-[125] flex justify-end sm:inset-x-auto sm:right-4">
      <div className="flex w-full max-w-sm flex-col gap-3 sm:w-[22rem]">
        {announcements.map((announcement) => (
          <section
            key={announcement.id}
            className={cn(
              'pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_22px_60px_rgba(0,0,0,0.35)] backdrop-blur',
              TONE_STYLES[announcement.tone]
            )}
          >
            <div className="flex items-start gap-3 p-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15">
                {announcement.tone === 'highlight' ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <BellRing className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {announcement.badge ? (
                      <span
                        className={cn(
                          'mb-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                          BADGE_STYLES[announcement.tone]
                        )}
                      >
                        {announcement.badge}
                      </span>
                    ) : null}
                    <h3 className="text-sm font-semibold leading-5">{announcement.title}</h3>
                  </div>

                  {announcement.dismissible ? (
                    <button
                      type="button"
                      onClick={() => dismissAnnouncement(announcement.id)}
                      className="rounded-full border border-white/10 bg-black/10 p-1 text-white/80 transition-colors hover:bg-black/20 hover:text-white"
                      aria-label={`Dismiss ${announcement.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <p className="mt-1.5 text-sm leading-6 text-white/80">
                  {announcement.message}
                </p>

                {announcement.ctaLabel && announcement.ctaHref ? (
                  <div className="mt-3">
                    <Button
                      asChild
                      size="sm"
                      className="h-8 rounded-full border border-white/15 bg-black/20 px-3 text-white hover:bg-black/30"
                    >
                      <Link href={announcement.ctaHref}>
                        {announcement.ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
