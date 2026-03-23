'use client';

import { TemplateCard } from './TemplateCard';
import type { TemplateMetadata } from '@/lib/templates/types';

interface TemplatesSectionProps {
  templates: TemplateMetadata[];
  onSelectTemplate: (templateId: string) => void;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export function TemplatesSection({
  templates,
  onSelectTemplate,
  showViewAll = false,
  onViewAll,
}: TemplatesSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Showcase</h2>
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            View all →
          </button>
        )}
      </div>

      {/* Showcase grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelectTemplate}
          />
        ))}
      </div>
    </section>
  );
}
