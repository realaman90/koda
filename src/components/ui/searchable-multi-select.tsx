'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
}

interface SearchableMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxSelected?: number;
  className?: string;
  triggerClassName?: string;
}

export function SearchableMultiSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  maxSelected,
  className,
  triggerClassName,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [position, setPosition] = React.useState<{ top?: number; bottom?: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOptions = React.useMemo(
    () => value.map((selected) => options.find((option) => option.value === selected)).filter(Boolean) as Option[],
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.group?.toLowerCase().includes(query)
    );
  }, [options, search]);

  const groupedOptions = React.useMemo(() => {
    const groups: { label: string | null; options: Option[] }[] = [];
    let currentGroup: string | null | undefined = undefined;

    for (const option of filteredOptions) {
      const group = option.group ?? null;
      if (group !== currentGroup) {
        groups.push({ label: group, options: [option] });
        currentGroup = group;
      } else {
        groups[groups.length - 1].options.push(option);
      }
    }

    return groups;
  }, [filteredOptions]);

  const hasGroups = options.some((option) => option.group);

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownMaxHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const bottomFromViewport = window.innerHeight - rect.top + 4;

    if (spaceBelow >= dropdownMaxHeight) {
      setPosition({ top: rect.bottom + 4, bottom: undefined, left: rect.left });
      return;
    }

    if (spaceAbove >= dropdownMaxHeight) {
      setPosition({ top: undefined, bottom: bottomFromViewport, left: rect.left });
      return;
    }

    if (spaceBelow >= spaceAbove) {
      setPosition({ top: rect.bottom + 4, bottom: undefined, left: rect.left });
      return;
    }

    setPosition({ top: undefined, bottom: bottomFromViewport, left: rect.left });
  }, [open]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleToggle = React.useCallback(
    (optionValue: string) => {
      const isSelected = value.includes(optionValue);
      if (isSelected) {
        onValueChange(value.filter((selected) => selected !== optionValue));
        return;
      }

      if (typeof maxSelected === 'number' && value.length >= maxSelected) {
        return;
      }

      onValueChange([...value, optionValue]);
    },
    [maxSelected, onValueChange, value]
  );

  const triggerLabel = React.useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions.length} selected`;
  }, [placeholder, selectedOptions]);

  const renderOption = (option: Option) => {
    const isSelected = value.includes(option.value);
    const maxedOut = typeof maxSelected === 'number' && value.length >= maxSelected && !isSelected;
    const isDisabled = option.disabled || maxedOut;

    return (
      <button
        key={option.value}
        type="button"
        onClick={() => {
          if (!isDisabled) handleToggle(option.value);
        }}
        disabled={isDisabled}
        className={cn(
          'w-full px-3 py-2 text-left transition-colors',
          'flex items-start gap-2',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-muted/50',
          isDisabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-4 w-4 items-center justify-center rounded border',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'
          )}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">{option.label}</span>
          {option.description && (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {option.description}
            </span>
          )}
        </span>
      </button>
    );
  };

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      data-searchable-multi-select="true"
      className="fixed z-[200] min-w-[240px] max-w-[320px] overflow-hidden rounded-lg border border-border bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        maxHeight: position.top != null
          ? `calc(100dvh - ${position.top}px - 8px)`
          : `calc(100dvh - ${position.bottom}px - 8px)`,
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        {typeof maxSelected === 'number' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {value.length}/{maxSelected} selected
          </p>
        )}
      </div>

      <div className="max-h-[320px] min-h-0 flex-1 overflow-y-auto py-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : hasGroups ? (
          groupedOptions.map((group) => (
            <div key={group.label ?? '__ungrouped'}>
              {group.label && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.options.map(renderOption)}
            </div>
          ))
        ) : (
          filteredOptions.map(renderOption)
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-8 items-center justify-between gap-2 rounded-md bg-muted/80 px-2 text-xs text-foreground transition-colors hover:bg-muted',
          triggerClassName
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <div className="flex items-center gap-1">
          {selectedOptions.length > 1 && (
            <span className="rounded bg-background px-1 py-0.5 text-[10px] text-muted-foreground">
              {selectedOptions.length}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
