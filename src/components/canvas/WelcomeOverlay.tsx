'use client';

import { useCallback } from 'react';
import { useCanvasStore, createImageGeneratorNode, createVideoGeneratorNode, createTextNode, createMediaNode } from '@/stores/canvas-store';
import {
  ImageIcon,
  Type,
  Video,
  FileImage,
} from 'lucide-react';

interface NodeTypeCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export function WelcomeOverlay() {
  const addNode = useCanvasStore((state) => state.addNode);
  const nodes = useCanvasStore((state) => state.nodes);

  const getCenterPosition = useCallback(() => ({
    x: window.innerWidth / 2 - 140,
    y: window.innerHeight / 2 - 100,
  }), []);

  const handleAddImageGenerator = useCallback(() => {
    addNode(createImageGeneratorNode(getCenterPosition()));
  }, [addNode, getCenterPosition]);

  const handleAddText = useCallback(() => {
    addNode(createTextNode(getCenterPosition()));
  }, [addNode, getCenterPosition]);

  const handleAddMedia = useCallback(() => {
    addNode(createMediaNode(getCenterPosition()));
  }, [addNode, getCenterPosition]);

  const handleAddVideoGenerator = useCallback(() => {
    addNode(createVideoGeneratorNode(getCenterPosition()));
  }, [addNode, getCenterPosition]);

  // Don't show if there are nodes
  if (nodes.length > 0) return null;

  const nodeTypes: NodeTypeCard[] = [
    {
      id: 'media',
      label: 'Media',
      icon: <FileImage className="h-6 w-6" />,
      color: 'text-blue-400',
      onClick: handleAddMedia,
    },
    {
      id: 'text',
      label: 'Text',
      icon: <Type className="h-6 w-6" />,
      color: 'text-teal-400',
      onClick: handleAddText,
    },
    {
      id: 'imageGenerator',
      label: 'Image Generator',
      icon: <ImageIcon className="h-6 w-6" />,
      color: 'text-purple-400',
      onClick: handleAddImageGenerator,
    },
    {
      id: 'videoGenerator',
      label: 'Video Generator',
      icon: <Video className="h-6 w-6" />,
      color: 'text-pink-400',
      onClick: handleAddVideoGenerator,
    },
  ];

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      {/* Decorative dotted arc */}
      <div className="absolute w-[600px] h-[300px] border-2 border-dashed border-zinc-300 dark:border-zinc-700/50 rounded-full -translate-y-8" />

      <div className="relative flex flex-col items-center gap-8 pointer-events-auto">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Your canvas is ready
          </h1>
          <p className="text-zinc-500 dark:text-zinc-500">
            Choose your first node and start creating
          </p>
        </div>

        {/* Node Type Cards */}
        <div className="flex gap-3">
          {nodeTypes.map((nodeType) => (
            <button
              key={nodeType.id}
              onClick={nodeType.onClick}
              className="group flex flex-col items-center justify-center w-[120px] h-[100px] rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-zinc-300 dark:border-zinc-700/50 transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:scale-105 cursor-pointer"
            >
              <div className={`mb-3 ${nodeType.color} transition-transform group-hover:scale-110`}>
                {nodeType.icon}
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{nodeType.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
