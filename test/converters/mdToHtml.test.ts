import { describe, expect, it } from 'vitest';
import { convertMdToRichClipboard } from '../../src/converters/mdToHtml';
import { loadSampleMarkdown } from '../helpers/loadFixture';
import { normalizeText } from '../helpers/normalize';

describe('convertMdToRichClipboard', () => {
  it('renders sample markdown to HTML and plain text', () => {
    const markdown = loadSampleMarkdown().replace(/\r\n/g, '\n');
    const { html, plainText } = convertMdToRichClipboard(markdown);

    expect(html).toContain('<h1');
    expect(html).toContain('Riverside Office Fit-Out Proposal');
    expect(html).toContain('<table');
    expect(html).toContain('<strong>');
    expect(html).toContain('<ul');

    const normalizedPlain = normalizeText(plainText);
    expect(normalizedPlain).toContain('Riverside Office Fit-Out Proposal');
    expect(normalizedPlain).toContain('Gross floor area');
  });

  describe('regression: README limitations', () => {
    it('does not render blockquotes as semantic blockquote HTML', () => {
      const { html } = convertMdToRichClipboard('> quoted\n');
      expect(html).not.toContain('<blockquote');
      expect(html).toContain('&gt; quoted');
    });

    it('does not crash on markdown images', () => {
      const { html, plainText } = convertMdToRichClipboard('![alt](img.png)\n');
      expect(html).toContain('img.png');
      expect(plainText).toBe('!alt');
    });
  });
});
