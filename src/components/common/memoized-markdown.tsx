import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lexer } from 'marked';

type MdComponents = Record<string, React.ComponentType<Record<string, unknown>>>;

interface MemoizedMarkdownBlockProps {
  content: string;
  components?: MdComponents;
}

const MemoizedMarkdownBlock = memo(
  ({ content, components }: MemoizedMarkdownBlockProps) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  ),
  (prev, next) => prev.content === next.content,
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

interface MemoizedMarkdownProps {
  content: string;
  id: string;
  components?: MdComponents;
  className?: string;
}

export function MemoizedMarkdown({ content, id, components, className }: MemoizedMarkdownProps) {
  const blocks = useMemo(() => {
    const tokens = Lexer.lex(content);
    return tokens.map((token) => token.raw);
  }, [content]);

  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <MemoizedMarkdownBlock
          key={`${id}-${i}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  );
}
