'use client';

import { useCallback, useRef, useState } from 'react';

interface ResizeHandleProps {
  onResize: (width: number, height: number) => void;
  visible: boolean;
  currentWidth: number;
  currentHeight: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function ResizeHandle({
  onResize,
  visible,
  currentWidth,
  currentHeight,
  minWidth = 200,
  minHeight = 100,
  maxWidth = 800,
  maxHeight = 600,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: currentWidth,
        height: currentHeight,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartRef.current) return;

        const deltaX = moveEvent.clientX - dragStartRef.current.x;
        const deltaY = moveEvent.clientY - dragStartRef.current.y;

        const newWidth = Math.min(maxWidth, Math.max(minWidth, dragStartRef.current.width + deltaX));
        const newHeight = Math.min(maxHeight, Math.max(minHeight, dragStartRef.current.height + deltaY));

        onResize(newWidth, newHeight);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [currentWidth, currentHeight, minWidth, minHeight, maxWidth, maxHeight, onResize]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        w-6 h-6 cursor-nwse-resize
        flex items-center justify-center
        transition-opacity duration-200
        ${isDragging ? 'opacity-100' : ''}
        ${visible || isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      title="Drag to resize"
    >
      {/* Resize corner lines */}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="w-4 h-4"
      >
        <path
          d="M14 16L16 14"
          stroke={isDragging ? '#f97316' : '#71717a'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 16L16 10"
          stroke={isDragging ? '#f97316' : '#71717a'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M6 16L16 6"
          stroke={isDragging ? '#f97316' : '#71717a'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
