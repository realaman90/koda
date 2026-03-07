import announcementsData from '@/config/announcements.json';

export type AnnouncementMode = 'dashboard' | 'canvas';
export type AnnouncementTone = 'info' | 'highlight' | 'success';

export interface AppAnnouncement {
  id: string;
  enabled: boolean;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  badge?: string;
  tone: AnnouncementTone;
  dismissible: boolean;
  modes?: AnnouncementMode[];
  startsAt?: string;
  endsAt?: string;
}

function isAnnouncementMode(value: unknown): value is AnnouncementMode {
  return value === 'dashboard' || value === 'canvas';
}

function isAnnouncementTone(value: unknown): value is AnnouncementTone {
  return value === 'info' || value === 'highlight' || value === 'success';
}

function isActiveWithinWindow(announcement: Pick<AppAnnouncement, 'startsAt' | 'endsAt'>): boolean {
  const now = Date.now();

  if (announcement.startsAt) {
    const startsAt = Date.parse(announcement.startsAt);
    if (Number.isFinite(startsAt) && startsAt > now) {
      return false;
    }
  }

  if (announcement.endsAt) {
    const endsAt = Date.parse(announcement.endsAt);
    if (Number.isFinite(endsAt) && endsAt < now) {
      return false;
    }
  }

  return true;
}

function normalizeAnnouncement(entry: unknown): AppAnnouncement | null {
  if (!entry || typeof entry !== 'object') return null;

  const raw = entry as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (typeof raw.message !== 'string' || !raw.message.trim()) return null;

  const modes = Array.isArray(raw.modes)
    ? raw.modes.filter(isAnnouncementMode)
    : undefined;

  return {
    id: raw.id.trim(),
    enabled: raw.enabled !== false,
    title: raw.title.trim(),
    message: raw.message.trim(),
    ctaLabel: typeof raw.ctaLabel === 'string' && raw.ctaLabel.trim() ? raw.ctaLabel.trim() : undefined,
    ctaHref: typeof raw.ctaHref === 'string' && raw.ctaHref.trim() ? raw.ctaHref.trim() : undefined,
    badge: typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim() : undefined,
    tone: isAnnouncementTone(raw.tone) ? raw.tone : 'info',
    dismissible: raw.dismissible !== false,
    modes: modes && modes.length > 0 ? modes : undefined,
    startsAt: typeof raw.startsAt === 'string' ? raw.startsAt : undefined,
    endsAt: typeof raw.endsAt === 'string' ? raw.endsAt : undefined,
  };
}

export const APP_ANNOUNCEMENTS: AppAnnouncement[] = Array.isArray(announcementsData)
  ? announcementsData
      .map((entry) => normalizeAnnouncement(entry))
      .filter((entry): entry is AppAnnouncement => entry !== null && entry.enabled && isActiveWithinWindow(entry))
  : [];

export function getAnnouncementsForMode(mode: AnnouncementMode): AppAnnouncement[] {
  return APP_ANNOUNCEMENTS.filter((announcement) => {
    if (!announcement.modes || announcement.modes.length === 0) {
      return true;
    }
    return announcement.modes.includes(mode);
  });
}
