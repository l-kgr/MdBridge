import { describe, expect, it } from 'vitest';
import { convertOdpToMd } from '../../src/converters/odpToMd';
import { buildMinimalOdp } from '../helpers/minimalOoxml';
import { normalizeText } from '../helpers/normalize';

describe('convertOdpToMd', () => {
  it('extracts slide text from minimal ODP', async () => {
    const buf = await buildMinimalOdp();
    const md = normalizeText(await convertOdpToMd(buf));

    expect(md).toContain('## Slide 1: Slide Title');
    expect(md).toContain('Slide body');
  });
});
