import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { convertMdToDocx } from '../../src/converters/mdToDocx';
import { loadSampleMarkdown } from '../helpers/loadFixture';

describe('convertMdToDocx', () => {
  it('produces a DOCX with expected structural content', async () => {
    const buf = await convertMdToDocx(loadSampleMarkdown().replace(/\r\n/g, '\n'));
    expect(buf.byteLength).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buf);
    const documentXml = await zip.file('word/document.xml')!.async('text');

    expect(documentXml).toContain('Riverside Office Fit-Out Proposal');
    expect(documentXml).toContain('Executive Summary');
    expect(documentXml).toContain('Gross floor area');
  });

  describe('regression: CRLF markdown export', () => {
    it('applies heading styles and bullet numbering', async () => {
      const md = '# Title\r\n\r\n- one\r\n- two\r\n';
      const buf = await convertMdToDocx(md);
      const zip = await JSZip.loadAsync(buf);
      const documentXml = await zip.file('word/document.xml')!.async('text');

      expect(documentXml).toContain('w:pStyle w:val="Heading1"');
      expect(documentXml).toContain('w:pStyle w:val="ListParagraph"');
      expect(documentXml).toMatch(/<w:numId w:val="1"/);
      expect(documentXml).not.toContain('# Title');
    });
  });

  describe('regression: README limitations', () => {
    it('converts blockquotes without throwing', async () => {
      const buf = await convertMdToDocx('> quoted text\n');
      expect(buf.byteLength).toBeGreaterThan(0);
    });
  });
});
