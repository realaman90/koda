/**
 * CodeBlock — Developer/Vercel-style code reveal with syntax highlighting
 *
 * Demonstrates:
 * - Line-by-line code reveal using frame-based index calculation
 * - Terminal chrome header (colored dots, filename tab)
 * - Syntax highlighting via inline color mapping (keywords, strings, comments)
 * - Monospace typography with line numbers
 * - Typing cursor animation
 * - Pure black + Vercel blue accent palette
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

/** Token types for syntax highlighting */
type TokenType = 'keyword' | 'string' | 'comment' | 'function' | 'number' | 'punctuation' | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

/** Simple tokenizer for display purposes */
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  const keywords = ['import', 'from', 'export', 'const', 'async', 'await', 'return', 'function', 'new', 'if', 'else', 'true', 'false', 'null'];

  if (line.trimStart().startsWith('//')) {
    tokens.push({ text: line, type: 'comment' });
    return tokens;
  }

  // Split by word boundaries while preserving whitespace and punctuation
  const parts = line.match(/(\s+|[{}()[\];:,=<>.]+|'[^']*'|"[^"]*"|`[^`]*`|\w+)/g) || [line];

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, type: 'plain' });
    } else if (/^['"`]/.test(part)) {
      tokens.push({ text: part, type: 'string' });
    } else if (keywords.includes(part)) {
      tokens.push({ text: part, type: 'keyword' });
    } else if (/^\d+$/.test(part)) {
      tokens.push({ text: part, type: 'number' });
    } else if (/^[{}()[\];:,=<>.]+$/.test(part)) {
      tokens.push({ text: part, type: 'punctuation' });
    } else {
      tokens.push({ text: part, type: 'plain' });
    }
  }

  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#0070F3',
  string: '#4ADE80',
  comment: '#525252',
  function: '#E2E8F0',
  number: '#F59E0B',
  punctuation: '#6B7280',
  plain: '#E2E8F0',
};

const SyntaxLine: React.FC<{
  line: string;
  lineNumber: number;
  opacity: number;
  showCursor: boolean;
}> = ({ line, lineNumber, opacity, showCursor }) => {
  const tokens = tokenizeLine(line);

  return (
    <div
      style={{
        display: 'flex',
        opacity,
        height: 28,
        alignItems: 'center',
      }}
    >
      {/* Line number */}
      <span
        style={{
          width: 48,
          textAlign: 'right',
          paddingRight: 20,
          color: '#333333',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {lineNumber}
      </span>

      {/* Code content */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
          fontSize: 14,
          whiteSpace: 'pre',
        }}
      >
        {tokens.map((token, i) => (
          <span key={i} style={{ color: TOKEN_COLORS[token.type] }}>
            {token.text}
          </span>
        ))}
        {showCursor && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 16,
              backgroundColor: '#0070F3',
              marginLeft: 1,
              verticalAlign: 'middle',
            }}
          />
        )}
      </span>
    </div>
  );
};

export const CodeBlock: React.FC<{
  filename?: string;
  code?: string[];
  framesPerLine?: number;
  accentColor?: string;
}> = ({
  filename = 'api/route.ts',
  code = [
    "import { NextResponse } from 'next/server'",
    '',
    'export async function GET() {',
    '  const data = await fetch(process.env.API_URL)',
    '  const json = await data.json()',
    '',
    '  return NextResponse.json({',
    '    status: 200,',
    '    results: json.items,',
    '    timestamp: new Date().toISOString(),',
    '  })',
    '}',
  ],
  framesPerLine = 8,
  accentColor = '#0070F3',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Card entrance ---
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.7 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- How many lines are visible ---
  const revealStart = 15;
  const visibleLines = Math.floor(
    interpolate(
      frame,
      [revealStart, revealStart + code.length * framesPerLine],
      [0, code.length],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    ),
  );

  // --- Cursor blink (visible on the last revealed line) ---
  const cursorBlink = Math.sin(frame * 0.15) > 0;

  // --- Header dots entrance ---
  const dotsOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Subtle glow behind editor */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 400,
          background: `radial-gradient(circle, ${accentColor}10 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* Editor card */}
      <div
        style={{
          opacity: cardSpring,
          transform: `scale(${cardScale})`,
          width: 620,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: `
            0 0 0 1px rgba(255, 255, 255, 0.06),
            0 8px 40px rgba(0, 0, 0, 0.5),
            0 0 80px ${accentColor}08
          `,
          background: '#0A0A0A',
        }}
      >
        {/* Terminal header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #1A1A1A',
            gap: 8,
          }}
        >
          {/* Traffic light dots */}
          <div style={{ display: 'flex', gap: 6, opacity: dotsOpacity }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF5F56' }} />
            <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFBD2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#27C93F' }} />
          </div>

          {/* Filename tab */}
          <div
            style={{
              marginLeft: 12,
              fontSize: 12,
              fontWeight: 500,
              color: '#525252',
              fontFamily: "'Inter', -apple-system, sans-serif",
              background: '#111111',
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid #1A1A1A',
            }}
          >
            {filename}
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: '16px 0 20px 16px' }}>
          {code.map((line, i) => {
            const lineVisible = i < visibleLines;
            const isLastVisible = i === visibleLines - 1;

            // Fade in each line
            const lineFrame = frame - (revealStart + i * framesPerLine);
            const lineOpacity = lineVisible
              ? interpolate(lineFrame, [0, 6], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              : 0;

            return (
              <SyntaxLine
                key={i}
                line={line}
                lineNumber={i + 1}
                opacity={lineOpacity}
                showCursor={isLastVisible && cursorBlink}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
