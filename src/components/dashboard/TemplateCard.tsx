'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import type { TemplateMetadata } from '@/lib/templates';

interface TemplateCardProps {
  template: TemplateMetadata;
  onSelect: (templateId: string) => void;
}

// Template metadata for video indicators
const videoTemplates = new Set(['video-production', 'storyboard']);

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const hasVideo = videoTemplates.has(template.id);
  const isImageThumbnail = template.thumbnail.startsWith('/');

  return (
    <button
      onClick={() => onSelect(template.id)}
      className="group text-left rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all cursor-pointer"
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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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
    </button>
  );
}
