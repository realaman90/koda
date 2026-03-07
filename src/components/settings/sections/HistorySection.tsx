'use client';

import { useState } from 'react';
import { Trash2, Image as ImageIcon, Video, Clock, AlertCircle, Search, Filter, Eye, Download, X } from 'lucide-react';
import { useSettingsStore, GenerationHistoryItem } from '@/stores/settings-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getUrlExtension(url: string, fallbackType: GenerationHistoryItem['type']): string {
  const clean = url.split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (match?.[1]) return match[1].toLowerCase();

  if (fallbackType === 'video') return 'mp4';
  if (fallbackType === 'svg') return 'svg';
  return 'png';
}

function buildDownloadFilename(item: GenerationHistoryItem, url: string, index?: number): string {
  const extension = getUrlExtension(url, item.type);
  const safeModel = item.model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const safeType = item.type.toLowerCase();
  const date = new Date(item.timestamp).toISOString().replace(/[:.]/g, '-');
  const suffix = typeof index === 'number' ? `-${index + 1}` : '';
  return `${safeType}-${safeModel}-${date}${suffix}.${extension}`;
}

function getPrimaryUrl(item: GenerationHistoryItem): string | undefined {
  return item.result?.urls?.[0] || item.compareResults?.find((result) => result.urls?.[0])?.urls?.[0];
}

function getCompareThumbnail(item: GenerationHistoryItem): string | undefined {
  return item.compareResults?.find((result) => result.thumbnailUrl)?.thumbnailUrl;
}

interface HistoryItemProps {
  item: GenerationHistoryItem;
  onDelete: () => void;
  onPreview: (url: string, type: GenerationHistoryItem['type'], title: string) => void;
  onDownload: (item: GenerationHistoryItem, url: string, index?: number) => void;
}

function HistoryItem({ item, onDelete, onPreview, onDownload }: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const primaryUrl = getPrimaryUrl(item);
  const compareThumbnail = getCompareThumbnail(item);
  const isCompareItem = item.mode === 'compare';

  return (
    <div className="bg-muted/50 rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          {primaryUrl ? (
            item.type === 'video' ? (
              <video
                src={primaryUrl}
                poster={compareThumbnail}
                className="w-full h-full object-cover"
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {item.status === 'failed' ? (
                <AlertCircle className="h-6 w-6 text-red-500" />
              ) : item.type === 'video' ? (
                <Video className="h-6 w-6 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.type === 'video' ? (
              <Video className="h-4 w-4 text-violet-400" />
            ) : (
              <ImageIcon className="h-4 w-4 text-blue-400" />
            )}
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {item.model}
            </span>
            {isCompareItem && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                Compare
              </span>
            )}
            {item.winnerModel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                Winner: {item.winnerModel}
              </span>
            )}
            {item.status !== 'completed' && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  item.status === 'failed'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {item.status}
              </span>
            )}
          </div>
          {item.models?.length ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {item.models.map((model) => (
                <span key={model} className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {model}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-sm text-foreground line-clamp-2">{item.prompt}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(item.timestamp)}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!primaryUrl) return;
              onPreview(primaryUrl, item.type, item.prompt);
            }}
            disabled={!primaryUrl}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!primaryUrl) return;
              onDownload(item, primaryUrl);
            }}
            disabled={!primaryUrl}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50">
          <div className="pt-4 space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Full Prompt</span>
              <p className="text-sm text-foreground mt-1">{item.prompt}</p>
            </div>
            {item.settings && (
              <div>
                <span className="text-xs text-muted-foreground">Settings</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(item.settings).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs px-2 py-1 bg-muted rounded text-foreground"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.error && (
              <div>
                <span className="text-xs text-red-400">Error</span>
                <p className="text-sm text-red-300 mt-1">{item.error}</p>
              </div>
            )}
            {item.result?.urls && item.result.urls.length > 1 && (
              <div>
                <span className="text-xs text-muted-foreground">All Results ({item.result.urls.length})</span>
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {item.result.urls.map((url, i) => (
                    <div key={i} className="relative flex-shrink-0 group/result">
                      <button
                        onClick={() => onPreview(url, item.type, item.prompt)}
                        className="block"
                        title={`Preview result ${i + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Result ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg hover:ring-2 hover:ring-primary"
                        />
                      </button>
                      <button
                        onClick={() => onDownload(item, url, i)}
                        className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover/result:opacity-100"
                        title={`Download result ${i + 1}`}
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {item.compareResults?.length ? (
              <div>
                <span className="text-xs text-muted-foreground">Compare Results</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {item.compareResults.map((result, index) => {
                    const url = result.urls?.[0];
                    const isWinner = item.winnerModel === result.model;
                    return (
                      <div key={`${result.model}-${index}`} className="rounded-lg border border-border/60 bg-background/70 p-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-md bg-muted">
                            {url ? (
                              item.type === 'video' ? (
                                <video src={url} poster={result.thumbnailUrl} className="h-full w-full object-cover" muted />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={result.model} className="h-full w-full object-cover" />
                              )
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                {result.status === 'failed' ? (
                                  <AlertCircle className="h-4 w-4 text-red-400" />
                                ) : item.type === 'video' ? (
                                  <Video className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{result.model}</span>
                              <span
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded',
                                  result.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-red-500/15 text-red-300'
                                )}
                              >
                                {result.status}
                              </span>
                              {isWinner && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                                  Winner
                                </span>
                              )}
                            </div>
                            {result.error && (
                              <p className="mt-1 text-[11px] text-red-300">{result.error}</p>
                            )}
                            {url && (
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  onClick={() => onPreview(url, item.type, `${item.prompt} (${result.model})`)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => onDownload(item, url)}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistorySection() {
  const history = useSettingsStore((state) => state.generationHistory);
  const clearHistory = useSettingsStore((state) => state.clearHistory);
  const removeFromHistory = useSettingsStore((state) => state.removeFromHistory);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'svg'>('all');
  const [preview, setPreview] = useState<{
    url: string;
    type: GenerationHistoryItem['type'];
    title: string;
  } | null>(null);

  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all generation history?')) {
      clearHistory();
      toast.success('History cleared');
    }
  };

  const handleDelete = (id: string) => {
    removeFromHistory(id);
    toast.success('Item removed');
  };

  const handleDownload = (item: GenerationHistoryItem, url: string, index?: number) => {
    const filename = buildDownloadFilename(item, url, index);
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['all', 'image', 'video', 'svg'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  filterType === type
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filteredHistory.length} of {history.length} items
          </span>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {history.length === 0
                ? 'No generation history yet'
                : 'No items match your search'}
            </p>
            <p className="text-sm text-muted-foreground/50 mt-1">
              {history.length === 0
                ? 'Your generations will appear here'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredHistory.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onPreview={(url, type, title) => setPreview({ url, type, title })}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-5xl rounded-xl border border-border bg-background p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute right-3 top-3 z-10 rounded-lg bg-black/40 p-2 text-white hover:bg-black/60"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-2 pr-12 text-sm text-muted-foreground line-clamp-1">
              {preview.title}
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-black/30">
              {preview.type === 'video' ? (
                <video
                  src={preview.url}
                  controls
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt="Generation preview"
                  className="max-h-[75vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
