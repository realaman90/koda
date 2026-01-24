'use client';

import { memo, useState, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

// Get edge color based on source/target handle types
function getEdgeColor(sourceHandleId?: string | null, targetHandleId?: string | null): string {
  // Text connections (text output to text input)
  if (targetHandleId === 'text') {
    return 'var(--edge-text)'; // Blue
  }
  // Image/reference connections
  if (targetHandleId === 'reference' || targetHandleId?.startsWith('ref')) {
    return 'var(--edge-image)'; // Orange/Amber
  }
  // Video connections
  if (targetHandleId === 'video' || sourceHandleId === 'video') {
    return 'var(--edge-video)'; // Purple
  }
  // Default
  return 'var(--edge-default)'; // Indigo
}

function DeletableEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  sourceHandleId,
  targetHandleId,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const setSelectedEdges = useCanvasStore((state) => state.setSelectedEdges);
  const selectedEdgeIds = useCanvasStore((state) => state.selectedEdgeIds);

  const isSelected = selected || selectedEdgeIds.includes(id);

  // Get the edge color based on connection type
  const edgeColor = useMemo(() => getEdgeColor(sourceHandleId, targetHandleId), [sourceHandleId, targetHandleId]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  const onEdgeSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle selection
    if (selectedEdgeIds.includes(id)) {
      setSelectedEdges(selectedEdgeIds.filter((eid) => eid !== id));
    } else {
      // Add to selection if shift key, otherwise replace
      if (e.shiftKey) {
        setSelectedEdges([...selectedEdgeIds, id]);
      } else {
        setSelectedEdges([id]);
      }
    }
  };

  return (
    <>
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onEdgeSelect}
        style={{ cursor: 'pointer' }}
        className="nopan"
      />

      {/* Visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isSelected ? '#f472b6' : isHovered ? edgeColor : edgeColor,
          strokeWidth: isSelected ? 3 : isHovered ? 2.5 : 2,
          opacity: isHovered ? 1 : 0.85,
          transition: 'stroke 0.15s, stroke-width 0.15s, opacity 0.15s',
        }}
      />

      {/* Delete button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            onClick={onEdgeDelete}
            className={`
              flex items-center justify-center
              w-6 h-6 rounded-full cursor-pointer
              border transition-all duration-150 shadow-lg
              hover:text-white hover:bg-red-500 hover:border-red-500
              ${isHovered || isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}
            `}
            style={{
              backgroundColor: 'var(--tooltip-bg)',
              borderColor: 'var(--tooltip-border)',
              color: 'var(--text-muted)',
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const DeletableEdge = memo(DeletableEdgeComponent);
