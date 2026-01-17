'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  useCanvasStore,
  createImageGeneratorNode,
  createVideoGeneratorNode,
  createTextNode,
  createMediaNode,
  createStickyNoteNode,
  createStickerNode,
  createGroupNode,
} from '@/stores/canvas-store';
import {
  Plus,
  ChevronDown,
  Type,
  Image as ImageIcon,
  Video,
  Sparkle,
  StickyNote,
  Smile,
  Group,
} from 'lucide-react';

interface NodeOption {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface NodeSection {
  title: string;
  items: NodeOption[];
}

export function AddNodeDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addNode = useCanvasStore((state) => state.addNode);
  const nodes = useCanvasStore((state) => state.nodes);
  const getViewportCenter = useCanvasStore((state) => state.getViewportCenter);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAddNode = (creator: (pos: { x: number; y: number }, name?: string) => ReturnType<typeof createImageGeneratorNode>, baseName?: string) => {
    const position = getViewportCenter();
    const count = nodes.filter((n) => n.type === creator({ x: 0, y: 0 }).type).length + 1;
    const node = baseName ? creator(position, `${baseName} ${count}`) : creator(position);
    addNode(node);
    setIsOpen(false);
  };

  const sections: NodeSection[] = [
    {
      title: 'NODES',
      items: [
        {
          id: 'image-gen',
          icon: (
            <div className="relative h-4 w-4">
              <ImageIcon className="h-4 w-4 text-emerald-400" />
              <Sparkle className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-emerald-400 text-emerald-400" />
            </div>
          ),
          label: 'Image Generator',
          onClick: () => handleAddNode(createImageGeneratorNode, 'Image Generator'),
        },
        {
          id: 'video-gen',
          icon: <Video className="h-4 w-4 text-blue-400" />,
          label: 'Video Generator',
          onClick: () => handleAddNode(createVideoGeneratorNode, 'Video Generator'),
        },
        {
          id: 'text',
          icon: <Type className="h-4 w-4 text-zinc-400" />,
          label: 'Text',
          onClick: () => handleAddNode(createTextNode as any),
        },
        {
          id: 'media',
          icon: <ImageIcon className="h-4 w-4 text-zinc-400" />,
          label: 'Media',
          onClick: () => handleAddNode(createMediaNode as any),
        },
      ],
    },
    {
      title: 'UTILITIES',
      items: [
        {
          id: 'sticky-note',
          icon: <StickyNote className="h-4 w-4 text-yellow-400" />,
          label: 'Sticky Note',
          onClick: () => handleAddNode(createStickyNoteNode as any),
        },
        {
          id: 'sticker',
          icon: <Smile className="h-4 w-4 text-zinc-400" />,
          label: 'Sticker',
          onClick: () => handleAddNode(createStickerNode as any),
        },
        {
          id: 'group',
          icon: <Group className="h-4 w-4 text-indigo-400" />,
          label: 'Group',
          onClick: () => handleAddNode(createGroupNode, 'Group'),
        },
      ],
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          h-8 px-2 gap-1 rounded-lg
          ${isOpen
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }
        `}
      >
        <Plus className="h-4 w-4" />
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-[180px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          {sections.map((section, sectionIndex) => (
            <div key={section.title}>
              {sectionIndex > 0 && <div className="border-t border-zinc-800" />}
              <div className="px-3 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                {section.title}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
