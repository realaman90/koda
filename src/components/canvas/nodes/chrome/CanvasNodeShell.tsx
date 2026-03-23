'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type FocusEventHandler, type MouseEventHandler, type ReactNode } from 'react';
import type { NodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';
import { cn } from '@/lib/utils';
import { NodeTitleRow } from './NodeTitleRow';

type InteractiveMode = 'visual' | 'prompt' | 'media' | 'editor' | 'lightweight';

interface CanvasNodeShellProps {
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  titleTrailing?: ReactNode;
  selected: boolean;
  hovered?: boolean;
  displayMode: NodeDisplayMode;
  hasOutput?: boolean;
  interactiveMode: InteractiveMode;
  stageMinHeight?: number;
  topToolbar?: ReactNode;
  footerRail?: ReactNode;
  promptOverlay?: ReactNode;
  showOverlayGradient?: boolean;
  overlayGradientHeight?: number;
  shellMode?: 'visual-stage' | 'structured-prompt';
  toolbar?: ReactNode;
  composer?: ReactNode;
  badges?: ReactNode;
  secondaryContent?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  cardClassName?: string;
  stageClassName?: string;
  style?: CSSProperties;
  cardStyle?: CSSProperties;
  stageStyle?: CSSProperties;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  focusProps?: {
    onFocusCapture: FocusEventHandler<HTMLElement>;
    onBlurCapture: FocusEventHandler<HTMLElement>;
  };
}

export function CanvasNodeShell({
  title,
  icon,
  subtitle,
  titleTrailing,
  selected,
  hovered = false,
  displayMode,
  hasOutput = false,
  interactiveMode,
  stageMinHeight,
  topToolbar,
  footerRail,
  promptOverlay,
  showOverlayGradient = true,
  overlayGradientHeight = 170,
  shellMode = 'visual-stage',
  toolbar,
  composer,
  badges,
  secondaryContent,
  children,
  className,
  titleClassName,
  cardClassName,
  stageClassName,
  style,
  cardStyle,
  stageStyle,
  onMouseEnter,
  onMouseLeave,
  focusProps,
}: CanvasNodeShellProps) {
  const showModernBottomOverlay = !!promptOverlay || !!footerRail;
  const showLegacyBottomOverlay = !showModernBottomOverlay && (!!toolbar || !!composer);
  const showBottomOverlay = showModernBottomOverlay || showLegacyBottomOverlay;
  const hasTopToolbar = !!topToolbar;
  const footerRailRef = useRef<HTMLDivElement>(null);
  const [measuredCardMinWidth, setMeasuredCardMinWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const railElement = footerRailRef.current;
    if (!railElement) {
      setMeasuredCardMinWidth(null);
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.ceil(railElement.scrollWidth + 24);
      setMeasuredCardMinWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(railElement);
    for (const child of Array.from(railElement.children)) {
      resizeObserver.observe(child);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [footerRail, displayMode, hasTopToolbar]);

  const resolvedCardStyle = measuredCardMinWidth
    ? ({ minWidth: `${measuredCardMinWidth}px`, ...cardStyle } satisfies CSSProperties)
    : cardStyle;

  return (
    <div
      className={cn('node-shell', hasTopToolbar && 'node-shell-has-top-toolbar', className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
      {...focusProps}
    >
      {hasTopToolbar ? <div className="node-shell-top-toolbar">{topToolbar}</div> : null}

      <NodeTitleRow
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={titleTrailing}
        className={titleClassName}
      />

      <div className="node-shell-card-wrap">
        <div
          className={cn(
            'node-shell-card node-card node-drag-handle node-drag-surface',
            selected && 'node-card-selected',
            hovered && 'node-shell-card-hovered',
            hasOutput ? 'node-stage-output' : 'node-stage-empty',
            `node-shell-${interactiveMode}`,
            cardClassName
          )}
          style={resolvedCardStyle}
        >
          <div
            className={cn(
              'node-shell-stage',
              displayMode === 'compact' && 'node-compact',
              displayMode === 'summary' && 'node-summary',
              stageClassName
            )}
            style={{
              minHeight: stageMinHeight,
              ...stageStyle,
            }}
          >
            {children}

            {badges ? <div className="node-shell-badges pointer-events-none">{badges}</div> : null}

            {showBottomOverlay && showOverlayGradient ? (
              <div className="node-shell-overlay-gradient pointer-events-none" style={{ height: overlayGradientHeight }} />
            ) : null}

            {showModernBottomOverlay ? (
              <div className={cn('node-shell-overlay node-shell-overlay-modern', `node-shell-mode-${shellMode}`)}>
                {promptOverlay}
                {footerRail ? <div ref={footerRailRef}>{footerRail}</div> : null}
              </div>
            ) : null}

            {showLegacyBottomOverlay ? (
              <div className="node-shell-overlay">
                {composer}
                {toolbar}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {secondaryContent ? <div className="node-shell-secondary">{secondaryContent}</div> : null}
    </div>
  );
}
