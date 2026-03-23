'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import { RemixIcon } from '@/components/common/RemixIcon';
import type { TemplateMetadata } from '@/lib/templates';

interface TemplateCardProps {
  template: TemplateMetadata;
  onSelect: (templateId: string) => void;
  onRemix?: (templateId: string) => void;
}

// Template metadata for video indicators
const videoTemplates = new Set(['video-production', 'storyboard']);

export function TemplateCard({ template, onSelect, onRemix }: TemplateCardProps) {
  const hasVideo = videoTemplates.has(template.id);
  const isImageThumbnail = template.thumbnail.startsWith('/');
  const canRemix = template.readOnly !== false;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(template.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(template.id);
        }
      }}
      className="group relative text-left rounded-xl overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {isImageThumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-6xl opacity-70 group-hover:scale-110 transition-transform duration-300">
              {template.thumbnail}
            </span>
          </div>
        )}

        {/* Video indicator */}
        {hasVideo && (
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

        {/* Remix CTA on hover */}
        {canRemix && onRemix && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemix(template.id);
            }}
            className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/75"
            aria-label={`Remix ${template.name}`}
          >
            <RemixIcon className="h-3.5 w-3.5" />
            Remix
          </button>
        )}
      </div>

      {/* Title */}
      <div className="p-3 bg-card">
        <h3 className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors line-clamp-2">
          {template.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {template.description}
        </p>
      </div>
    </article>
  );
}
