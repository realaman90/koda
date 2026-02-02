'use client';

/**
 * QuestionPhase Component
 * 
 * Style clarification gate with multiple choice options.
 * Based on Plan: Question Phase - Clarification Gate
 */

import { useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AnimationQuestion, AnimationStyleOption } from '../types';

interface QuestionPhaseProps {
  question: AnimationQuestion;
  onSelect: (styleId: string, customStyle?: string) => void;
  isLoading?: boolean;
}

export function QuestionPhase({ question, onSelect, isLoading }: QuestionPhaseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleOptionClick = useCallback((option: AnimationStyleOption) => {
    if (option.id === 'custom' || option.id === 'other') {
      setShowCustomInput(true);
      setSelectedOption(option.id);
    } else {
      setSelectedOption(option.id);
      setShowCustomInput(false);
      setCustomInput('');
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (!selectedOption || isLoading) return;

    if (showCustomInput && customInput.trim()) {
      onSelect(selectedOption, customInput.trim());
    } else if (!showCustomInput) {
      onSelect(selectedOption);
    }
  }, [selectedOption, showCustomInput, customInput, isLoading, onSelect]);

  const canContinue = selectedOption && (!showCustomInput || customInput.trim());

  return (
    <div className="space-y-4">
      {/* Question text */}
      <p className="text-sm text-zinc-300">{question.text}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option)}
            disabled={isLoading}
            className={`w-full p-3 rounded-lg text-left transition-all ${
              selectedOption === option.id
                ? 'bg-blue-600/20 border border-blue-500 ring-1 ring-blue-500/50'
                : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === option.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-zinc-500'
                }`}
              >
                {selectedOption === option.id && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{option.label}</p>
                {option.description && (
                  <p className="text-xs text-zinc-400 mt-0.5">{option.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Custom/Other option */}
        {question.customInput && (
          <button
            onClick={() => handleOptionClick({ id: 'custom', label: 'Other (describe below)' })}
            disabled={isLoading}
            className={`w-full p-3 rounded-lg text-left transition-all ${
              selectedOption === 'custom' || selectedOption === 'other'
                ? 'bg-blue-600/20 border border-blue-500 ring-1 ring-blue-500/50'
                : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === 'custom' || selectedOption === 'other'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-zinc-500'
                }`}
              >
                {(selectedOption === 'custom' || selectedOption === 'other') && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
              <p className="text-sm font-medium text-zinc-100">Other (describe below)</p>
            </div>
          </button>
        )}
      </div>

      {/* Custom input field */}
      {showCustomInput && (
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Describe your preferred style..."
          disabled={isLoading}
          className="bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
      )}

      {/* Continue button */}
      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isLoading}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Continue</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
