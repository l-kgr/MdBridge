import {
  MarkdownBlock,
  normalizeRowCells,
  parseInlineSpans,
  parseMarkdownToBlocks,
  spansToPlainText
} from './markdownBlocks';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineHtml(text: string, forceBold = false): string {
  return parseInlineSpans(text)
    .map((span) => {
      const content = escapeHtml(span.text);
      const bold = forceBold || span.bold;
      let inner: string;
      if (span.code) {
        inner = `<code>${content}</code>`;
      } else if (bold && span.italics) {
        inner = `<strong><em>${content}</em></strong>`;
      } else if (bold) {
        inner = `<strong>${content}</strong>`;
      } else if (span.italics) {
        inner = `<em>${content}</em>`;
      } else {
        inner = content;
      }
      if (span.link) {
        return `<a href="${escapeHtml(span.link)}">${inner}</a>`;
      }
      return inner;
    })
    .join('');
}

function renderTableHtml(headers: string[], rows: string[][]): string {
  const columnCount = headers.length;
  const headerHtml = normalizeRowCells(headers, columnCount)
    .map((cell) => `<th style="border:1px solid #ccc;padding:4px 8px;">${renderInlineHtml(cell, true)}</th>`)
    .join('');
  const bodyHtml = rows
    .map((row) => {
      const cells = normalizeRowCells(row, columnCount)
        .map((cell) => `<td style="border:1px solid #ccc;padding:4px 8px;">${renderInlineHtml(cell)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table style="border-collapse:collapse;margin:8px 0;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function blockToHtml(block: MarkdownBlock): string {
  switch (block.type) {
    case 'empty':
      return '<p>&nbsp;</p>';
    case 'heading': {
      const tag = `h${block.level}`;
      return `<${tag} style="margin:12px 0 6px;">${renderInlineHtml(block.text)}</${tag}>`;
    }
    case 'paragraph':
      return `<p style="margin:0 0 8px;">${renderInlineHtml(block.text)}</p>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items
        .map((item) => `<li style="margin:0 0 4px;">${renderInlineHtml(item)}</li>`)
        .join('');
      return `<${tag} style="margin:0 0 8px;padding-left:24px;">${items}</${tag}>`;
    }
    case 'code':
      return `<pre style="margin:8px 0;padding:8px;background:#f5f5f5;font-family:Consolas,monospace;"><code>${escapeHtml(block.text)}</code></pre>`;
    case 'table':
      return renderTableHtml(block.headers, block.rows);
  }
}

function blockToPlainText(block: MarkdownBlock): string {
  switch (block.type) {
    case 'empty':
      return '';
    case 'heading':
    case 'paragraph':
      return spansToPlainText(parseInlineSpans(block.text));
    case 'list':
      return block.items
        .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
        .join('\n');
    case 'code':
      return block.text;
    case 'table': {
      const columnCount = block.headers.length;
      const headerLine = normalizeRowCells(block.headers, columnCount).join('\t');
      const rowLines = block.rows.map((row) => normalizeRowCells(row, columnCount).join('\t'));
      return [headerLine, ...rowLines].join('\n');
    }
  }
}

export function convertMdToRichClipboard(markdown: string): { html: string; plainText: string } {
  const blocks = parseMarkdownToBlocks(markdown);
  const html = blocks.map(blockToHtml).join('');
  const plainText = blocks.map(blockToPlainText).join('\n');
  return { html, plainText };
}
