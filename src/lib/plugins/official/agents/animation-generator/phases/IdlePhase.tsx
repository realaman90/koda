'use client';

/**
 * IdlePhase Component
 * 
 * Initial state - now just shows instructions since ChatInput is in parent.
 * Based on Pencil design: Node/AnimationGenerator/Dark
 */

interface IdlePhaseProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function IdlePhase({ isLoading }: IdlePhaseProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="h-4 w-4 border-2 border-zinc-500 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-sm">Analyzing...</span>
        </div>
      </div>
    );
  }

  return null; // ChatInput is rendered in parent
}
