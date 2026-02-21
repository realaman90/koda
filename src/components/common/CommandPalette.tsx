"use client";

import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Home, 
  FolderOpen, 
  Settings, 
  Plus, 
  Download, 
  Upload,
  Clock,
  Moon,
  Sun,
  HelpCircle,
  Sparkles
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const isOpen = controlledOpen ?? open;
  const setIsOpen = onOpenChange ?? setOpen;

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  const navigateTo = useCallback((path: string) => {
    router.push(path);
    setIsOpen(false);
  }, [router, setIsOpen]);

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      label="Command Palette"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[600px] bg-[var(--node-card-bg)] border border-[var(--node-card-border)] rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden"
    >
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[-1]"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div className="flex items-center border-b border-[var(--node-card-border)] px-4 py-3">
        <Search className="w-5 h-5 text-[var(--text-muted)] mr-3" />
        <Command.Input
          placeholder="Search commands..."
          className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>
      
      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-[var(--text-muted)]">
          No results found.
        </Command.Empty>
        
        <Command.Group heading="Navigation" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3 pt-2">
          <Command.Item
            onSelect={() => navigateTo("/")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Command.Item>
          
          <Command.Item
            onSelect={() => navigateTo("/canvas")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Go to Projects</span>
          </Command.Item>
          
          <Command.Item
            onSelect={() => navigateTo("/settings")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Settings className="w-4 h-4" />
            <span>Go to Settings</span>
          </Command.Item>
        </Command.Group>
        
        <Command.Group heading="Actions" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3 pt-2">
          <Command.Item
            onSelect={() => navigateTo("/canvas?new=true")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">⌘N</span>
          </Command.Item>
          
          <Command.Item
            onSelect={() => {/* Import action */}}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Download className="w-4 h-4" />
            <span>Import Project</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">⌘I</span>
          </Command.Item>
          
          <Command.Item
            onSelect={() => {/* Export action */}}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Upload className="w-4 h-4" />
            <span>Export Data</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">⌘E</span>
          </Command.Item>
        </Command.Group>
        
        <Command.Group heading="Recent" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3 pt-2">
          <Command.Item
            onSelect={() => navigateTo("/canvas")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Clock className="w-4 h-4" />
            <span>Recent Project</span>
          </Command.Item>
        </Command.Group>
        
        <Command.Group heading="Settings" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3 pt-2">
          <Command.Item
            onSelect={() => {/* Toggle theme */}}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <Sun className="w-4 h-4" />
            <span>Toggle Theme</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">⌘⇧T</span>
          </Command.Item>
          
          <Command.Item
            onSelect={() => navigateTo("/settings")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--node-card-bg-secondary)] data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-[rgba(245,158,11,0.15)] data-[selected=true]:to-[rgba(236,72,153,0.15)]"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Keyboard Shortcuts</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
      
      <div className="border-t border-[var(--node-card-border)] px-4 py-2 text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Sparkles className="w-3 h-3 text-[var(--accent-amber)]" />
        <span>Type to search or use arrow keys</span>
        <span className="ml-auto">ESC to close</span>
      </div>
    </Command.Dialog>
  );
}
