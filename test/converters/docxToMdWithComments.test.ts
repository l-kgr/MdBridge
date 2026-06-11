import { describe, expect, it } from 'vitest';
import { convertDocxToMdWithComments } from '../../src/converters/docxToMd';
import { buildMinimalDocxWithComments } from '../helpers/minimalDocx';
import { normalizeText } from '../helpers/normalize';

describe('convertDocxToMdWithComments', () => {
  it('includes comment body text and footnote definitions', async () => {
    const buf = await buildMinimalDocxWithComments();
    const md = normalizeText(await convertDocxToMdWithComments(buf));

    expect(md).toContain('Commented text');
    expect(md).toMatch(/\[\^[^\]]+\]/);
    expect(md).toContain('## Comments');
    expect(md).toContain('Please review this');
    expect(md).toContain('Alice');
  });
});
