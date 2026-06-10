export interface InlineSpan {
  text: string;
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  link?: string;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkdownBlock =
  | { type: 'empty' }
  | { type: 'heading'; level: HeadingLevel; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language?: string; text: string };

export function parseInlineSpans(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let pos = 0;

  while (pos < text.length) {
    const rest = text.slice(pos);

    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      spans.push({ text: linkMatch[1], link: linkMatch[2] });
      pos += linkMatch[0].length;
      continue;
    }

    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      spans.push({ text: codeMatch[1], code: true });
      pos += codeMatch[0].length;
      continue;
    }

    const boldItalicMatch = rest.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) {
      spans.push({ text: boldItalicMatch[1], bold: true, italics: true });
      pos += boldItalicMatch[0].length;
      continue;
    }

    const boldMatch = rest.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      spans.push({ text: boldMatch[1], bold: true });
      pos += boldMatch[0].length;
      continue;
    }

    const italicMatch = rest.match(/^\*([^*]+?)\*/);
    if (italicMatch) {
      spans.push({ text: italicMatch[1], italics: true });
      pos += italicMatch[0].length;
      continue;
    }

    const nextSpecial = rest.search(/[\[*`]/);
    if (nextSpecial === -1) {
      spans.push({ text: rest });
      break;
    }
    if (nextSpecial === 0) {
      spans.push({ text: rest[0] });
      pos += 1;
    } else {
      spans.push({ text: rest.slice(0, nextSpecial) });
      pos += nextSpecial;
    }
  }

  return spans.length ? spans : [{ text }];
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith('|')) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && !isTableSeparator(trimmed);
}

function parseHeading(line: string): { level: HeadingLevel; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) {
    return null;
  }
  return { level: match[1].length as HeadingLevel, text: match[2] };
}

function parseListItem(line: string): { ordered: boolean; text: string } | null {
  const unordered = line.match(/^[-*+]\s+(.+)$/);
  if (unordered) {
    return { ordered: false, text: unordered[1] };
  }
  const ordered = line.match(/^\d+\.\s+(.+)$/);
  if (ordered) {
    return { ordered: true, text: ordered[1] };
  }
  return null;
}

function isCodeFence(line: string): boolean {
  return /^```/.test(line.trim());
}

function parseCodeFenceOpener(line: string): string | undefined {
  const match = line.trim().match(/^```(\w*)$/);
  return match ? match[1] || undefined : undefined;
}

function isSpecialLine(line: string): boolean {
  return (
    line.trim() === '' ||
    !!parseHeading(line) ||
    isTableRow(line) ||
    !!parseListItem(line) ||
    isCodeFence(line)
  );
}

function collectParagraph(lines: string[], start: number): { text: string; end: number } {
  const parts = [lines[start].trim()];
  let i = start + 1;
  while (i < lines.length && !isSpecialLine(lines[i])) {
    parts.push(lines[i].trim());
    i++;
  }
  return { text: parts.join(' '), end: i };
}

export function normalizeRowCells(cells: string[], columnCount: number): string[] {
  const normalized = cells.slice(0, columnCount);
  while (normalized.length < columnCount) {
    normalized.push('');
  }
  return normalized;
}

export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  const stripped = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();
  const lines = stripped.split('\n');
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line);
      i += 2;

      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }

      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (isCodeFence(line)) {
      const language = parseCodeFenceOpener(line);
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      blocks.push({ type: 'code', language, text: codeLines.join('\n') });
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, text: heading.text });
      i++;
      continue;
    }

    const firstListItem = parseListItem(line);
    if (firstListItem) {
      const ordered = firstListItem.ordered;
      const items = [firstListItem.text];
      i++;
      while (i < lines.length) {
        const item = parseListItem(lines[i]);
        if (!item || item.ordered !== ordered) {
          break;
        }
        items.push(item.text);
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph = collectParagraph(lines, i);
    blocks.push({ type: 'paragraph', text: paragraph.text });
    i = paragraph.end;
  }

  return blocks;
}

export function spansToPlainText(spans: InlineSpan[]): string {
  return spans.map((span) => span.text).join('');
}
