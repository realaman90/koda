type BudgetConfig = {
  modelTokenLimit: number;
  compressAtRatio: number;
};

type PromptBudgetResult = {
  estimatedTokens: number;
  compressionThresholdTokens: number;
  modelTokenLimit: number;
  shouldCompress: boolean;
};

type FileContext = {
  path: string;
  content: string;
};

function safeNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

export function estimateTokens(text: string): number {
  // Fast approximation for prompt budgeting.
  return Math.ceil(text.length / 4);
}

export function getPromptBudgetConfig(): BudgetConfig {
  const modelTokenLimit = Math.max(10_000, Math.floor(safeNumber(process.env.KODA_CODEGEN_MODEL_TOKEN_LIMIT, 200_000)));
  const compressAtRatio = clamp(safeNumber(process.env.KODA_CODEGEN_COMPRESS_AT_RATIO, 0.95), 0.5, 0.99);
  return { modelTokenLimit, compressAtRatio };
}

export function getPromptBudgetResult(prompt: string, config = getPromptBudgetConfig()): PromptBudgetResult {
  const estimatedTokens = estimateTokens(prompt);
  const compressionThresholdTokens = Math.floor(config.modelTokenLimit * config.compressAtRatio);
  return {
    estimatedTokens,
    compressionThresholdTokens,
    modelTokenLimit: config.modelTokenLimit,
    shouldCompress: estimatedTokens >= compressionThresholdTokens,
  };
}

export function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars < 80) return text.slice(0, maxChars);
  const head = Math.floor(maxChars * 0.6);
  const tail = Math.floor(maxChars * 0.3);
  return `${text.slice(0, head)}\n\n... [truncated ${text.length - (head + tail)} chars] ...\n\n${text.slice(-tail)}`;
}

export function extractQueryKeywords(input: string, maxKeywords = 12): string[] {
  if (!input) return [];
  const stopwords = new Set([
    'the', 'and', 'with', 'from', 'into', 'onto', 'that', 'this', 'then', 'than', 'when', 'where',
    'make', 'add', 'edit', 'change', 'update', 'replace', 'remove', 'please', 'need', 'want',
    'animation', 'video', 'scene', 'file', 'code', 'there', 'have', 'has', 'for', 'your', 'our',
  ]);
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9_\-/\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 3 && !stopwords.has(w));

  const unique: string[] = [];
  for (const word of words) {
    if (!unique.includes(word)) unique.push(word);
    if (unique.length >= maxKeywords) break;
  }
  return unique;
}

function scorePath(path: string, keywords: string[], preferred: string[]): number {
  const lower = path.toLowerCase();
  const fileName = lower.split('/').pop() || lower;
  let score = 0;

  for (const pref of preferred) {
    const prefLower = pref.toLowerCase();
    if (lower.endsWith(prefLower)) score += 100;
    else if (lower.includes(prefLower)) score += 40;
  }

  for (const kw of keywords) {
    if (fileName.includes(kw)) score += 25;
    else if (lower.includes(kw)) score += 10;
  }

  if (lower.includes('/sequences/')) score += 8;
  if (lower.includes('/components/')) score += 8;
  if (lower.endsWith('.tsx')) score += 5;
  return score;
}

export function pickTargetFiles(
  allPaths: string[],
  changeRequest: string,
  preferred: string[],
  maxFiles = 4,
): string[] {
  const keywords = extractQueryKeywords(changeRequest);
  const scored = allPaths
    .filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))
    .map((path) => ({ path, score: scorePath(path, keywords, preferred) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const top = scored.slice(0, Math.max(1, maxFiles)).map((s) => s.path);

  // Ensure preferred core files are considered if no keyword match surfaced them.
  for (const pref of preferred) {
    const found = allPaths.find((p) => p.toLowerCase().endsWith(pref.toLowerCase()));
    if (found && !top.includes(found) && top.length < maxFiles) top.push(found);
  }
  return top.slice(0, maxFiles);
}

function collectSymbolLines(lines: string[], maxSymbols = 10): string[] {
  const symbolRegex = /^\s*(export\s+)?(async\s+)?(function|const|class|type|interface)\s+[A-Za-z0-9_]+/;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (symbolRegex.test(lines[i])) {
      out.push(`L${i + 1}: ${lines[i].trim()}`);
      if (out.length >= maxSymbols) break;
    }
  }
  return out;
}

function collectKeywordWindows(lines: string[], keywords: string[], maxWindows = 8): string[] {
  if (keywords.length === 0) return [];
  const windows: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (!keywords.some((kw) => lower.includes(kw))) continue;
    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length - 1, i + 2);
    const key = `${start}:${end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const snippet = lines
      .slice(start, end + 1)
      .map((line, idx) => `L${start + idx + 1}: ${line}`)
      .join('\n');
    windows.push(snippet);
    if (windows.length >= maxWindows) break;
  }

  return windows;
}

export function summarizeFileForChange(
  filePath: string,
  content: string,
  changeRequest: string,
  maxChars = 8_000,
): string {
  const lines = content.split('\n');
  const keywords = extractQueryKeywords(changeRequest);
  const importLines = lines
    .filter((line) => line.trim().startsWith('import '))
    .slice(0, 12)
    .map((line) => line.trim());
  const symbols = collectSymbolLines(lines);
  const windows = collectKeywordWindows(lines, keywords);

  const parts: string[] = [];
  parts.push(`FILE: ${filePath}`);
  parts.push(`STATS: ${lines.length} lines, ${content.length} chars`);
  if (importLines.length > 0) {
    parts.push('IMPORTS:');
    parts.push(...importLines);
  }
  if (symbols.length > 0) {
    parts.push('SYMBOLS:');
    parts.push(...symbols);
  }
  if (windows.length > 0) {
    parts.push('RELEVANT SNIPPETS:');
    parts.push(...windows);
  } else {
    parts.push('RELEVANT SNIPPETS: none matched; use symbols/imports for navigation.');
  }

  const summary = parts.join('\n');
  return truncateMiddle(summary, maxChars);
}

function parseMultiFileContent(maybeCombinedContent: string): FileContext[] {
  const lines = maybeCombinedContent.split('\n');
  const sections: FileContext[] = [];
  let currentPath: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentPath) return;
    sections.push({ path: currentPath, content: buffer.join('\n') });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^---\s+(.+?)\s+---$/);
    if (match) {
      flush();
      currentPath = match[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

export function compressModifyContentForPrompt(
  currentContent: string,
  changeRequest: string,
  maxFiles = 4,
  perFileChars = 5_000,
): string {
  const parsed = parseMultiFileContent(currentContent);
  const sections = parsed.length > 0 ? parsed.slice(0, maxFiles) : [{ path: 'target-file', content: currentContent }];

  const compressedParts: string[] = [];
  compressedParts.push('AUTO-COMPRESSED CONTEXT (95% token-budget safeguard)');
  compressedParts.push('Use this structural summary to apply the requested edit precisely.');
  compressedParts.push(`Requested change: ${changeRequest || 'unspecified change'}`);
  compressedParts.push('');

  for (const section of sections) {
    compressedParts.push(summarizeFileForChange(section.path, section.content, changeRequest, perFileChars));
    compressedParts.push('');
  }

  return compressedParts.join('\n').trim();
}

export function buildMultiFileContext(
  files: FileContext[],
  changeRequest: string,
  maxCharsPerFile = 14_000,
): string {
  return files
    .map(({ path, content }) => {
      const body = content.length <= maxCharsPerFile
        ? truncateMiddle(content, maxCharsPerFile)
        : summarizeFileForChange(path, content, changeRequest, maxCharsPerFile);
      return `--- ${path} ---\n${body}`;
    })
    .join('\n\n');
}
