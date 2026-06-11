import { describe, expect, it } from 'vitest';
import { convertDocxToMd } from '../../src/converters/docxToMd';
import { buildMinimalDocx } from '../helpers/minimalDocx';
import { normalizeText } from '../helpers/normalize';

describe('convertDocxToMd', () => {
  it('converts minimal DOCX to markdown', async () => {
    const buf = await buildMinimalDocx();
    const md = normalizeText(await convertDocxToMd(buf));

    expect(md).toContain('# Hello World');
    expect(md).toContain('Body paragraph');
    expect(md).toContain('Col A');
    expect(md).toContain('Col B');
  });

  describe('regression', () => {
    it('handles empty-ish DOCX without throwing', async () => {
      const buf = await buildMinimalDocx();
      const md = await convertDocxToMd(buf);
      expect(md.length).toBeGreaterThan(0);
    });
  });
});
