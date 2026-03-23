'use client';

import { useCallback, useRef, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import type { ImagePortRole } from '@/lib/types';

export interface ConnectedImageChip {
  sourceNodeId: string;
  label: string;
  role: ImagePortRole;
  url: string;
}

interface ImageChipBarProps {
  chips: ConnectedImageChip[];
  supportedRoles: ImagePortRole[];
  prompt: string;
  onLabelChange: (sourceNodeId: string, newLabel: string) => void;
  onRoleChange: (sourceNodeId: string, newRole: ImagePortRole) => void;
  onDisconnect: (sourceNodeId: string) => void;
}

const ROLE_LABELS: Record<ImagePortRole, string> = {
  reference: 'Ref',
  style: 'Style',
  ip_adapter: 'IP-Adapter',
  controlnet: 'ControlNet',
  base: 'Base',
  element: 'Element',
  face: 'Face',
};

export function ImageChipBar({
  chips,
  supportedRoles,
  prompt,
  onLabelChange,
  onRoleChange,
  onDisconnect,
}: ImageChipBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showRoleDropdown = supportedRoles.length > 1;

  const isLabelUsedInPrompt = useCallback(
    (label: string) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|\\s)@${escaped}(?:\\s|$)`);
      return pattern.test(prompt);
    },
    [prompt]
  );

  const handleStartEdit = useCallback((sourceNodeId: string) => {
    setEditingId(sourceNodeId);
    // Focus input on next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleFinishEdit = useCallback(
    (sourceNodeId: string, value: string) => {
      const sanitized = value
        .replace(/[^a-zA-Z0-9_\s-]/g, '')
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
      if (sanitized && sanitized !== chips.find((c) => c.sourceNodeId === sourceNodeId)?.label) {
        onLabelChange(sourceNodeId, sanitized);
      }
      setEditingId(null);
    },
    [chips, onLabelChange]
  );

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
      {chips.map((chip) => {
        const isUsed = isLabelUsedInPrompt(chip.label);
        const isEditing = editingId === chip.sourceNodeId;

        return (
          <div
            key={chip.sourceNodeId}
            className={`
              group flex items-center gap-1 rounded-md border px-1.5 py-0.5
              text-[10px] transition-opacity
              ${isUsed
                ? 'border-border/70 bg-muted/50 text-text-secondary'
                : 'border-border/40 bg-muted/30 text-text-tertiary opacity-60'
              }
            `}
          >
            {/* Thumbnail */}
            {chip.url ? (
              <img
                src={chip.url}
                alt=""
                className="h-5 w-5 rounded object-cover shrink-0"
                draggable={false}
              />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            )}

            {/* Label (editable) */}
            {isEditing ? (
              <input
                ref={inputRef}
                className="bg-transparent border-none outline-none text-[10px] text-text-primary w-16 min-w-0 nodrag nopan"
                defaultValue={chip.label}
                onBlur={(e) => handleFinishEdit(chip.sourceNodeId, e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    handleFinishEdit(chip.sourceNodeId, (e.target as HTMLInputElement).value);
                  }
                  if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                className="truncate max-w-[80px] hover:text-text-primary transition-colors cursor-text nodrag nopan"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(chip.sourceNodeId);
                }}
                title={`Click to rename "${chip.label}". Use @${chip.label} in prompt to reference.`}
              >
                {chip.label}
              </button>
            )}

            {/* Role dropdown (only for structured models) */}
            {showRoleDropdown && (
              <select
                className="bg-transparent border-none outline-none text-[9px] text-text-tertiary cursor-pointer nodrag nopan appearance-none"
                value={chip.role}
                onChange={(e) => {
                  e.stopPropagation();
                  onRoleChange(chip.sourceNodeId, e.target.value as ImagePortRole);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Image role"
              >
                {supportedRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            )}

            {/* Disconnect button */}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:text-red-400 nodrag nopan"
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect(chip.sourceNodeId);
              }}
              title="Disconnect"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
