'use client';

import { useState } from 'react';
import { Trash2, Image, Video, Clock, AlertCircle, Search, Filter } from 'lucide-react';
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

function HistoryItem({ item, onDelete }: { item: GenerationHistoryItem; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-zinc-800/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-700">
          {item.result?.urls[0] ? (
            item.type === 'video' ? (
              <video
                src={item.result.urls[0]}
                className="w-full h-full object-cover"
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.result.urls[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {item.status === 'failed' ? (
                <AlertCircle className="h-6 w-6 text-red-500" />
              ) : item.type === 'video' ? (
                <Video className="h-6 w-6 text-zinc-500" />
              ) : (
                <Image className="h-6 w-6 text-zinc-500" />
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.type === 'video' ? (
              <Video className="h-4 w-4 text-purple-400" />
            ) : (
              <Image className="h-4 w-4 text-blue-400" />
            )}
            <span className="text-xs font-medium text-zinc-400 uppercase">
              {item.model}
            </span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                item.status === 'completed'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              )}
            >
              {item.status}
            </span>
          </div>
          <p className="text-sm text-zinc-200 line-clamp-2">{item.prompt}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(item.timestamp)}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-700/50">
          <div className="pt-4 space-y-3">
            <div>
              <span className="text-xs text-zinc-500">Full Prompt</span>
              <p className="text-sm text-zinc-300 mt-1">{item.prompt}</p>
            </div>
            {item.settings && (
              <div>
                <span className="text-xs text-zinc-500">Settings</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(item.settings).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-300"
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
                <span className="text-xs text-zinc-500">All Results ({item.result.urls.length})</span>
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {item.result.urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Result ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg hover:ring-2 hover:ring-indigo-500"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
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
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');

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

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          {(['all', 'image', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                filterType === type
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">
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
          <Filter className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400">
            {history.length === 0
              ? 'No generation history yet'
              : 'No items match your search'}
          </p>
          <p className="text-sm text-zinc-600 mt-1">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
