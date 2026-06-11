import { describe, expect, it } from 'vitest';
import { buildCfHtml } from '../../src/utils/clipboardRichText';

function parseCfHtmlOffsets(cfHtml: string): Record<string, number> {
  const lines = cfHtml.split('\r\n').filter((line) => line.includes(':'));
  const offsets: Record<string, number> = {};
  for (const line of lines) {
    const match = line.match(/^(StartHTML|EndHTML|StartFragment|EndFragment):(\d+)$/);
    if (match) {
      offsets[match[1]] = parseInt(match[2], 10);
    }
  }
  return offsets;
}

describe('buildCfHtml', () => {
  it('produces internally consistent CF_HTML byte offsets', () => {
    const fragment = '<p>Hello <strong>world</strong></p>';
    const cfHtml = buildCfHtml(fragment);
    const buf = Buffer.from(cfHtml, 'utf8');
    const offsets = parseCfHtmlOffsets(cfHtml);

    expect(offsets.StartHTML).toBeTypeOf('number');
    expect(buf.slice(offsets.StartHTML, offsets.EndHTML).toString('utf8')).toMatch(
      /^<html><body>/
    );
    expect(
      buf.slice(offsets.StartFragment, offsets.EndFragment).toString('utf8')
    ).toBe(fragment);
  });

  it('uses UTF-8 byte lengths for non-ASCII fragments', () => {
    const fragment = '<p>Café — €</p>';
    const cfHtml = buildCfHtml(fragment);
    const buf = Buffer.from(cfHtml, 'utf8');
    const offsets = parseCfHtmlOffsets(cfHtml);

    expect(buf.slice(offsets.StartFragment, offsets.EndFragment).toString('utf8')).toBe(fragment);
    expect(offsets.EndHTML).toBe(buf.byteLength);
  });

  it('includes required CF_HTML markers', () => {
    const cfHtml = buildCfHtml('<p>x</p>');
    expect(cfHtml).toContain('Version:1.0');
    expect(cfHtml).toContain('<!--StartFragment-->');
    expect(cfHtml).toContain('<!--EndFragment-->');
  });
});
