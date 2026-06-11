import { describe, expect, it } from 'vitest';
import { convertOdtToMd } from '../../src/converters/odtToMd';
import { buildMinimalOdt } from '../helpers/minimalOoxml';
import { normalizeText } from '../helpers/normalize';

describe('convertOdtToMd', () => {
  it('converts minimal ODT to markdown', async () => {
    const buf = await buildMinimalOdt();
    const md = normalizeText(await convertOdtToMd(buf));

    expect(md).toContain('ODT Heading');
    expect(md).toContain('First paragraph');
    expect(md).toContain('Second paragraph');
  });
});
