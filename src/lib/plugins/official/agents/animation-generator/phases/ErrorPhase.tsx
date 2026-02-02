'use client';

/**
 * ErrorPhase Component
 * 
 * Shows error message with retry/start over options.
 * Based on Pencil design: Node/AnimationGenerator/Error/Dark
 */

import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnimationError } from '../types';

interface ErrorPhaseProps {
  error: AnimationError;
  onRetry: () => void;
  onStartOver: () => void;
  isLoading?: boolean;
}

export function ErrorPhase({ error, onRetry, onStartOver, isLoading }: ErrorPhaseProps) {
  return (
    <div className="space-y-4">
      {/* Error message */}
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-300">{error.message}</p>
            {error.details && (
              <p className="text-xs text-red-400/70">{error.details}</p>
            )}
            {error.code && (
              <p className="text-xs text-zinc-500 font-mono">Code: {error.code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onStartOver}
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Start Over
        </Button>

        {error.canRetry && (
          <div className="ml-auto">
            <Button
              onClick={onRetry}
              disabled={isLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Retrying...</span>
                </div>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
