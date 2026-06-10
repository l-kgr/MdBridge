import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

function extractText(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const paragraphs: string[] = [];

  const paras = doc.getElementsByTagName('a:p');
  for (let i = 0; i < paras.length; i++) {
    const runs = paras[i].getElementsByTagName('a:t');
    const text = Array.from({ length: runs.length }, (_, j) => runs[j].textContent ?? '').join('');
    if (text.trim()) {
      paragraphs.push(text.trim());
    }
  }
  return paragraphs;
}

export async function convertPptxToMd(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });

  const sections: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const paragraphs = extractText(xml);
    if (!paragraphs.length) {
      continue;
    }

    const [heading, ...body] = paragraphs;
    sections.push(`## Slide ${i + 1}: ${heading}`);
    if (body.length) {
      sections.push(body.join('\n\n'));
    }
  }

  return sections.join('\n\n') + '\n';
}
