'use client';

import { TemplateCard } from './TemplateCard';
import type { TemplateMetadata } from '@/lib/templates/types';
import type { TemplateFilter } from './hooks/useDashboardState';

const templateFilters: { id: TemplateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'featured', label: 'Featured' },
  { id: 'workflow', label: 'Workflows' },
  { id: 'creative', label: 'Creative' },
  { id: 'starter', label: 'Starter' },
];

interface TemplatesSectionProps {
  templates: TemplateMetadata[];
  activeFilter: TemplateFilter;
  onFilterChange: (filter: TemplateFilter) => void;
  onSelectTemplate: (templateId: string) => void;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export function TemplatesSection({
  templates,
  activeFilter,
  onFilterChange,
  onSelectTemplate,
  showViewAll = false,
  onViewAll,
}: TemplatesSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Templates</h2>
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            View all →
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {templateFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === filter.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
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
