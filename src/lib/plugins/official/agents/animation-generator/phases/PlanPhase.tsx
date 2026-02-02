'use client';

/**
 * PlanPhase Component
 * 
 * Shows AI-generated plan with Accept/Reject approval gate.
 * ChatInput for feedback is now in parent component.
 * Based on Pencil design: Node/AnimationGenerator/Plan/Dark
 */

import { Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnimationPlan } from '../types';

interface PlanPhaseProps {
  plan: AnimationPlan;
  onAccept: () => void;
  onReject: () => void;
  onRevise: (feedback: string) => void;
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}

export function PlanPhase({ plan, onAccept, onReject, isLoading }: PlanPhaseProps) {
  // Calculate cumulative times for display
  let cumulativeTime = 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="text-base">📍</span>
        <span className="font-medium text-zinc-200">Animation Plan</span>
        <span className="ml-auto flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {formatDuration(plan.totalDuration)}
        </span>
      </div>

      {/* Scenes list */}
      <div className="space-y-2">
        {plan.scenes.map((scene) => {
          const startTime = formatDuration(cumulativeTime);
          const endTime = formatDuration(cumulativeTime + scene.duration);
          cumulativeTime += scene.duration;

          return (
            <div
              key={scene.number}
              className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
            >
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-xs font-medium text-zinc-200">
                  Scene {scene.number} — {scene.title}
                </span>
                <span className="text-[10px] text-zinc-500">
                  ({startTime}–{endTime})
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {scene.description}
              </p>
              {scene.animationNotes && (
                <p className="text-[10px] text-blue-400/70 mt-1 italic">
                  {scene.animationNotes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Style badge */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
          {plan.style}
        </span>
        <span>•</span>
        <span>{plan.fps} fps</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={onReject}
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="flex-1 h-8 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-xs"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
        <Button
          onClick={onAccept}
          disabled={isLoading}
          size="sm"
          className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Starting...</span>
            </div>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Accept Plan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
