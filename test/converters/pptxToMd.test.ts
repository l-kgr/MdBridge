import { describe, expect, it } from 'vitest';
import { convertPptxToMd } from '../../src/converters/pptxToMd';
import { buildMinimalPptx } from '../helpers/minimalOoxml';
import { normalizeText } from '../helpers/normalize';

describe('convertPptxToMd', () => {
  it('extracts slide title and body text', async () => {
    const buf = await buildMinimalPptx();
    const md = normalizeText(await convertPptxToMd(buf));

    expect(md).toContain('## Slide 1: Slide Title');
    expect(md).toContain('Body paragraph');
  });

  describe('regression', () => {
    it('returns newline-terminated output for slides with text', async () => {
      const md = await convertPptxToMd(await buildMinimalPptx());
      expect(md.endsWith('\n')).toBe(true);
    });
  });
});
