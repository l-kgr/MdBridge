import { describe, expect, it } from 'vitest';
import {
  normalizeRowCells,
  parseInlineSpans,
  parseMarkdownToBlocks,
  spansToPlainText
} from '../../src/converters/markdownBlocks';

describe('parseInlineSpans', () => {
  it.each([
    ['plain text', [{ text: 'plain text' }]],
    ['**bold**', [{ text: 'bold', bold: true }]],
    ['*italic*', [{ text: 'italic', italics: true }]],
    ['***both***', [{ text: 'both', bold: true, italics: true }]],
    ['`code`', [{ text: 'code', code: true }]],
    ['[link](https://example.com)', [{ text: 'link', link: 'https://example.com' }]],
    [
      '**bold** and *italic*',
      [
        { text: 'bold', bold: true },
        { text: ' and ', italics: undefined },
        { text: 'italic', italics: true }
      ]
    ]
  ])('parses %j', (input, expected) => {
    const spans = parseInlineSpans(input);
    expect(spans).toEqual(expected.map((s) => ({ ...s })));
  });

  it('treats lone asterisk as literal characters between text spans', () => {
    expect(parseInlineSpans('unmatched * here')).toEqual([
      { text: 'unmatched ' },
      { text: '*' },
      { text: ' here' }
    ]);
  });

  it('returns single empty span for empty input', () => {
    expect(parseInlineSpans('')).toEqual([{ text: '' }]);
  });
});

describe('normalizeRowCells', () => {
  it('pads short rows', () => {
    expect(normalizeRowCells(['a', 'b'], 4)).toEqual(['a', 'b', '', '']);
  });

  it('truncates long rows', () => {
    expect(normalizeRowCells(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('spansToPlainText', () => {
  it('joins span text without formatting', () => {
    expect(
      spansToPlainText([
        { text: 'Hello ', bold: true },
        { text: 'world', italics: true }
      ])
    ).toBe('Hello world');
  });
});

describe('parseMarkdownToBlocks', () => {
  it('strips YAML frontmatter', () => {
    const md = '---\ntitle: Test\n---\n\n# Heading\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      { type: 'heading', level: 1, text: 'Heading' }
    ]);
  });

  it('parses headings h1 through h6', () => {
    const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n';
    const blocks = parseMarkdownToBlocks(md);
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'H1' },
      { type: 'heading', level: 2, text: 'H2' },
      { type: 'heading', level: 3, text: 'H3' },
      { type: 'heading', level: 4, text: 'H4' },
      { type: 'heading', level: 5, text: 'H5' },
      { type: 'heading', level: 6, text: 'H6' }
    ]);
  });

  it('parses GFM tables with edge pipes', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      {
        type: 'table',
        headers: ['A', 'B'],
        rows: [['1', '2']]
      }
    ]);
  });

  it('parses GFM tables without edge pipes', () => {
    const md = 'A | B\n--- | ---\n1 | 2\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      {
        type: 'table',
        headers: ['A', 'B'],
        rows: [['1', '2']]
      }
    ]);
  });

  it('groups consecutive list items', () => {
    const md = '- one\n- two\n\n1. first\n2. second\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      { type: 'list', ordered: false, items: ['one', 'two'] },
      { type: 'empty' },
      { type: 'list', ordered: true, items: ['first', 'second'] }
    ]);
  });

  it('parses fenced code blocks with language', () => {
    const md = '```ts\nconst x = 1;\nline two\n```\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      { type: 'code', language: 'ts', text: 'const x = 1;\nline two' }
    ]);
  });

  it('joins soft-wrapped paragraph lines', () => {
    const md = 'Line one\nline two\n\n# Next\n';
    expect(parseMarkdownToBlocks(md)).toEqual([
      { type: 'paragraph', text: 'Line one line two' },
      { type: 'empty' },
      { type: 'heading', level: 1, text: 'Next' }
    ]);
  });

  it('parses empty lines as empty blocks', () => {
    expect(parseMarkdownToBlocks('a\n\nb')).toEqual([
      { type: 'paragraph', text: 'a' },
      { type: 'empty' },
      { type: 'paragraph', text: 'b' }
    ]);
  });

  it('treats unclosed code fence as code to end of file', () => {
    const blocks = parseMarkdownToBlocks('```\nno close\nstill code\n');
    expect(blocks).toEqual([{ type: 'code', language: undefined, text: 'no close\nstill code' }]);
  });

  describe('regression: CRLF line endings', () => {
    it('parses headings and lists when lines end with \\r\\n', () => {
      const md = '# Title\r\n\r\n- one\r\n- two\r\n';
      const blocks = parseMarkdownToBlocks(md);
      expect(blocks).toEqual([
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'empty' },
        { type: 'list', ordered: false, items: ['one', 'two'] }
      ]);
    });
  });

  describe('regression: README limitations', () => {
    it('treats blockquotes as paragraphs (no special blockquote type)', () => {
      const blocks = parseMarkdownToBlocks('> quoted text\n');
      expect(blocks[0]).toEqual({ type: 'paragraph', text: '> quoted text' });
    });

    it('treats markdown images as paragraph text', () => {
      const blocks = parseMarkdownToBlocks('![alt](image.png)\n');
      expect(blocks[0]).toEqual({ type: 'paragraph', text: '![alt](image.png)' });
    });
  });
});
