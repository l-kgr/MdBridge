import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

function localName(el: Element): string {
  return el.localName ?? el.tagName.split(':').pop() ?? el.tagName;
}

function extractPageText(pageEl: Element): string[] {
  const paragraphs: string[] = [];

  function walk(node: Node): void {
    if (node.nodeType !== 1) {
      return;
    }

    const el = node as Element;
    const name = localName(el);

    if (name === 'p' || name === 'h') {
      const text = el.textContent?.trim();
      if (text) {
        paragraphs.push(text);
      }
      return;
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]);
    }
  }

  walk(pageEl);
  return paragraphs;
}

function findPresentationPages(contentXml: string): string[][] {
  const doc = new DOMParser().parseFromString(contentXml, 'text/xml');
  const pages: string[][] = [];
  const pageNodes = doc.getElementsByTagName('draw:page');

  for (let i = 0; i < pageNodes.length; i++) {
    const paragraphs = extractPageText(pageNodes[i] as Element);
    if (paragraphs.length) {
      pages.push(paragraphs);
    }
  }

  if (pages.length) {
    return pages;
  }

  const bodies = doc.getElementsByTagName('office:body');
  if (bodies.length) {
    for (let i = 0; i < bodies[0].childNodes.length; i++) {
      const child = bodies[0].childNodes[i];
      if (child.nodeType === 1 && localName(child as Element) === 'presentation') {
        const presentation = child as Element;
        for (let j = 0; j < presentation.childNodes.length; j++) {
          const pageChild = presentation.childNodes[j];
          if (pageChild.nodeType === 1 && localName(pageChild as Element) === 'page') {
            const paragraphs = extractPageText(pageChild as Element);
            if (paragraphs.length) {
              pages.push(paragraphs);
            }
          }
        }
      }
    }
  }

  return pages;
}

export async function convertOdpToMd(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const contentFile = zip.file('content.xml');
  if (!contentFile) {
    throw new Error('ODP file is missing content.xml');
  }

  const contentXml = await contentFile.async('text');
  const slides = findPresentationPages(contentXml);
  const sections: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const [heading, ...body] = slides[i];
    sections.push(`## Slide ${i + 1}: ${heading}`);
    if (body.length) {
      sections.push(body.join('\n\n'));
    }
  }

  return sections.join('\n\n') + (sections.length ? '\n' : '');
}
