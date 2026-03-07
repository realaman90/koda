'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Download, Loader2, Trash2, Video, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompareRunStatus, ImageCompareResult, VideoCompareResult } from '@/lib/types';

type CompareResult = ImageCompareResult | VideoCompareResult;

interface CompareResultsSectionProps<T extends CompareResult> {
  type: 'image' | 'video';
  results: T[];
  runStatus?: CompareRunStatus;
  promotedCompareResultId?: string;
  getModelLabel: (model: T['model']) => string;
  onPromote?: (result: T) => void;
  onClear?: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

function getPrimaryUrl(result: CompareResult): string | undefined {
  if ('outputUrls' in result) {
    return result.outputUrl || result.outputUrls?.[0];
  }
  return result.outputUrl;
}

function getStatusTone(status: CompareResult['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'failed':
      return 'bg-red-500/15 text-red-300';
    case 'running':
      return 'bg-amber-500/15 text-amber-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function CompareResultsSection<T extends CompareResult>({
  type,
  results,
  runStatus,
  promotedCompareResultId,
  getModelLabel,
  onPromote,
  onClear,
  collapsible = false,
  defaultOpen = true,
  className,
}: CompareResultsSectionProps<T>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!collapsible) {
      setIsOpen(true);
      return;
    }

    if (results.length > 0 && runStatus === 'running') {
      setIsOpen(true);
    }
  }, [collapsible, results.length, runStatus]);

  const summary = useMemo(() => {
    const completed = results.filter((result) => result.status === 'completed').length;
    const failed = results.filter((result) => result.status === 'failed').length;
    return `${completed} complete${failed ? `, ${failed} failed` : ''}`;
  }, [results]);

  const handleDownload = (url: string, extension: 'png' | 'mp4') => {
    const filename = `${type}-compare-${Date.now()}.${extension}`;
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const anchor = document.createElement('a');
    anchor.href = proxyUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <div className={cn('border-t border-border/50 bg-background/70', className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
            <span className="text-xs font-medium text-foreground">Compare Results</span>
            <span className="text-[11px] text-muted-foreground">{summary}</span>
          </button>
        ) : (
          <>
            <span className="text-xs font-medium text-foreground">Compare Results</span>
            <span className="text-[11px] text-muted-foreground">{summary}</span>
          </>
        )}

        {runStatus && runStatus !== 'idle' && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {runStatus.replace('_', ' ')}
          </span>
        )}

        <div className="ml-auto" />

        {onClear && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            title="Clear compare"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 gap-3 px-3 pb-3">
          {results.map((result) => {
            const primaryUrl = getPrimaryUrl(result);
            const isPromoted = result.id === promotedCompareResultId;
            const canPromote = result.status === 'completed' && !!primaryUrl && !!onPromote;

            return (
              <div
                key={result.id}
                className={cn(
                  'overflow-hidden rounded-xl border border-border/60 bg-muted/20',
                  isPromoted && 'border-emerald-500/50 ring-1 ring-emerald-500/30'
                )}
              >
                <div className="aspect-video overflow-hidden bg-muted/40">
                  {primaryUrl ? (
                    type === 'video' ? (
                      <video
                        src={primaryUrl}
                        poster={'thumbnailUrl' in result ? result.thumbnailUrl : undefined}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryUrl}
                        alt={getModelLabel(result.model)}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      {result.status === 'running' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : result.status === 'failed' ? (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      ) : type === 'video' ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <ImageIcon className="h-5 w-5" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {getModelLabel(result.model)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', getStatusTone(result.status))}>
                          {result.status}
                        </span>
                        <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {result.estimatedCredits} cr
                        </span>
                        {isPromoted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Promoted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {result.error && (
                    <p className="line-clamp-2 text-[11px] text-red-300">
                      {result.error}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {canPromote && (
                      <Button
                        size="sm"
                        onClick={() => onPromote?.(result)}
                        className="h-7 flex-1 text-xs"
                      >
                        Promote
                      </Button>
                    )}

                    {primaryUrl && (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleDownload(primaryUrl, type === 'video' ? 'mp4' : 'png')}
                        className="h-7 w-7"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
