import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { createTurndownService } from './turndownConfig';

interface OdtParts {
  contentXml: string;
  stylesXml: string | null;
}

interface TextStyleProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  monospace?: boolean;
}

function localName(el: Element): string {
  return el.localName ?? el.tagName.split(':').pop() ?? el.tagName;
}

function getAttr(el: Element, local: string): string | null {
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    const name = attr.localName ?? attr.name.split(':').pop() ?? attr.name;
    if (name === local) {
      return attr.value;
    }
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseStyleProps(stylesXml: string | null): Map<string, TextStyleProps> {
  const styles = new Map<string, TextStyleProps>();
  if (!stylesXml) {
    return styles;
  }

  const doc = new DOMParser().parseFromString(stylesXml, 'text/xml');
  const styleNodes = doc.getElementsByTagName('style:style');

  for (let i = 0; i < styleNodes.length; i++) {
    const styleEl = styleNodes[i];
    const name = getAttr(styleEl, 'name');
    if (!name) {
      continue;
    }

    const props: TextStyleProps = {};
    const family = getAttr(styleEl, 'family');

    if (family === 'text') {
      const textProps = styleEl.getElementsByTagName('style:text-properties')[0];
      if (textProps) {
        const weight = getAttr(textProps, 'font-weight');
        const style = getAttr(textProps, 'font-style');
        const decoration = getAttr(textProps, 'text-underline-style');
        const lineThrough = getAttr(textProps, 'text-line-through-style');
        const position = getAttr(textProps, 'text-position');
        const fontName = getAttr(textProps, 'font-name');

        if (weight === 'bold') {
          props.bold = true;
        }
        if (style === 'italic') {
          props.italic = true;
        }
        if (decoration && decoration !== 'none') {
          props.underline = true;
        }
        if (lineThrough && lineThrough !== 'none') {
          props.strike = true;
        }
        if (position?.includes('super')) {
          props.superscript = true;
        }
        if (position?.includes('sub')) {
          props.subscript = true;
        }
        if (fontName?.toLowerCase().includes('courier') || fontName?.toLowerCase().includes('mono')) {
          props.monospace = true;
        }
      }
    }

    const lowerName = name.toLowerCase();
    if (lowerName.includes('heading') || lowerName.includes('title')) {
      props.bold = props.bold ?? true;
    }
    if (lowerName.includes('strong') || lowerName.includes('bold')) {
      props.bold = true;
    }
    if (lowerName.includes('emphasis') || lowerName.includes('italic')) {
      props.italic = true;
    }
    if (lowerName.includes('code') || lowerName.includes('source')) {
      props.monospace = true;
    }

    if (Object.keys(props).length) {
      styles.set(name, props);
    }
  }

  return styles;
}

function parseListStyles(stylesXml: string | null): Map<string, boolean> {
  const listStyles = new Map<string, boolean>();
  if (!stylesXml) {
    return listStyles;
  }

  const doc = new DOMParser().parseFromString(stylesXml, 'text/xml');
  const styleNodes = doc.getElementsByTagName('style:style');

  for (let i = 0; i < styleNodes.length; i++) {
    const styleEl = styleNodes[i];
    const name = getAttr(styleEl, 'name');
    if (!name || getAttr(styleEl, 'family') !== 'list') {
      continue;
    }

    const numberStyle = styleEl.getElementsByTagName('text:list-level-style-number')[0];
    const bulletStyle = styleEl.getElementsByTagName('text:list-level-style-bullet')[0];
    listStyles.set(name, !!numberStyle && !bulletStyle);
  }

  return listStyles;
}

function inferStyleFromName(styleName: string | null, styleProps: Map<string, TextStyleProps>): TextStyleProps {
  if (!styleName) {
    return {};
  }

  const fromStyles = styleProps.get(styleName);
  if (fromStyles) {
    return fromStyles;
  }

  const lower = styleName.toLowerCase();
  const inferred: TextStyleProps = {};
  if (lower.includes('strong') || lower.includes('bold')) {
    inferred.bold = true;
  }
  if (lower.includes('emphasis') || lower.includes('italic')) {
    inferred.italic = true;
  }
  if (lower.includes('strike') || lower.includes('strikethrough')) {
    inferred.strike = true;
  }
  if (lower.includes('code') || lower.includes('source') || lower.includes('verbatim')) {
    inferred.monospace = true;
  }
  if (lower.includes('superscript') || lower.includes('super')) {
    inferred.superscript = true;
  }
  if (lower.includes('subscript') || lower.includes('sub')) {
    inferred.subscript = true;
  }
  return inferred;
}

function wrapInnerWithStyle(inner: string, props: TextStyleProps): string {
  if (!inner) {
    return '';
  }
  let html = inner;
  if (props.monospace) {
    html = `<code>${html}</code>`;
  }
  if (props.bold) {
    html = `<strong>${html}</strong>`;
  }
  if (props.italic) {
    html = `<em>${html}</em>`;
  }
  if (props.strike) {
    html = `<s>${html}</s>`;
  }
  if (props.superscript) {
    html = `<sup>${html}</sup>`;
  }
  if (props.subscript) {
    html = `<sub>${html}</sub>`;
  }
  if (props.underline) {
    html = `<u>${html}</u>`;
  }
  return html;
}

function hasStyleProps(props: TextStyleProps): boolean {
  return !!(
    props.bold ||
    props.italic ||
    props.strike ||
    props.monospace ||
    props.superscript ||
    props.subscript ||
    props.underline
  );
}

function inlineToHtml(node: Node, styleProps: Map<string, TextStyleProps>): string {
  if (node.nodeType === 3) {
    return escapeHtml(node.textContent ?? '');
  }
  if (node.nodeType !== 1) {
    return '';
  }

  const el = node as Element;
  const name = localName(el);

  switch (name) {
    case 'span':
      return spanToHtml(el, styleProps);
    case 'a': {
      const href = getAttr(el, 'href') ?? '#';
      const inner = Array.from({ length: el.childNodes.length }, (_, i) =>
        inlineToHtml(el.childNodes[i], styleProps)
      ).join('');
      return `<a href="${escapeHtml(href)}">${inner}</a>`;
    }
    case 'line-break':
      return '<br>';
    case 'tab':
      return ' ';
    case 's': {
      const count = parseInt(getAttr(el, 'c') ?? '1', 10);
      return ' '.repeat(Number.isFinite(count) ? count : 1);
    }
    default: {
      return Array.from({ length: el.childNodes.length }, (_, i) =>
        inlineToHtml(el.childNodes[i], styleProps)
      ).join('');
    }
  }
}

function spanToHtml(el: Element, styleProps: Map<string, TextStyleProps>): string {
  const styleName = getAttr(el, 'style-name');
  const props = inferStyleFromName(styleName, styleProps);
  const inner = Array.from({ length: el.childNodes.length }, (_, i) =>
    inlineToHtml(el.childNodes[i], styleProps)
  ).join('');
  if (!hasStyleProps(props)) {
    return inner;
  }
  return wrapInnerWithStyle(inner, props);
}

function paragraphToHtml(el: Element, styleProps: Map<string, TextStyleProps>): string {
  const inner = Array.from({ length: el.childNodes.length }, (_, i) => {
    const child = el.childNodes[i];
    if (child.nodeType === 1 && localName(child as Element) === 'span') {
      return spanToHtml(child as Element, styleProps);
    }
    return inlineToHtml(child, styleProps);
  }).join('');
  return inner;
}

function listToHtml(
  el: Element,
  styleProps: Map<string, TextStyleProps>,
  listStyles: Map<string, boolean>
): string {
  const styleName = getAttr(el, 'style-name');
  const ordered = styleName ? (listStyles.get(styleName) ?? false) : false;
  const tag = ordered ? 'ol' : 'ul';
  const items: string[] = [];

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType !== 1 || localName(child as Element) !== 'list-item') {
      continue;
    }
    const listItem = child as Element;
    const itemParts: string[] = [];
    for (let j = 0; j < listItem.childNodes.length; j++) {
      const itemChild = listItem.childNodes[j];
      if (itemChild.nodeType !== 1) {
        continue;
      }
      const itemEl = itemChild as Element;
      const itemName = localName(itemEl);
      if (itemName === 'p' || itemName === 'h') {
        itemParts.push(paragraphToHtml(itemEl, styleProps));
      } else if (itemName === 'list') {
        itemParts.push(listToHtml(itemEl, styleProps, listStyles));
      }
    }
    items.push(`<li>${itemParts.join(' ')}</li>`);
  }

  return `<${tag}>${items.join('')}</${tag}>`;
}

function tableToHtml(el: Element, styleProps: Map<string, TextStyleProps>): string {
  const rows: string[] = [];

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType !== 1 || localName(child as Element) !== 'table-row') {
      continue;
    }
    const rowEl = child as Element;
    const cells: string[] = [];

    for (let j = 0; j < rowEl.childNodes.length; j++) {
      const cellNode = rowEl.childNodes[j];
      if (cellNode.nodeType !== 1) {
        continue;
      }
      const cellName = localName(cellNode as Element);
      if (cellName !== 'table-cell' && cellName !== 'covered-table-cell') {
        continue;
      }
      if (cellName === 'covered-table-cell') {
        continue;
      }

      const cellEl = cellNode as Element;
      const cellParts: string[] = [];
      for (let k = 0; k < cellEl.childNodes.length; k++) {
        const cellChild = cellEl.childNodes[k];
        if (cellChild.nodeType !== 1) {
          continue;
        }
        const cellChildEl = cellChild as Element;
        const childName = localName(cellChildEl);
        if (childName === 'p' || childName === 'h') {
          cellParts.push(paragraphToHtml(cellChildEl, styleProps));
        }
      }
      cells.push(`<td>${cellParts.join('<br>')}</td>`);
    }

    if (cells.length) {
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
  }

  return rows.length ? `<table>${rows.join('')}</table>` : '';
}

function blockToHtml(
  el: Element,
  styleProps: Map<string, TextStyleProps>,
  listStyles: Map<string, boolean>
): string {
  const name = localName(el);

  switch (name) {
    case 'h': {
      const level = Math.min(6, Math.max(1, parseInt(getAttr(el, 'outline-level') ?? '1', 10)));
      const inner = paragraphToHtml(el, styleProps);
      return inner ? `<h${level}>${inner}</h${level}>` : '';
    }
    case 'p': {
      const inner = paragraphToHtml(el, styleProps);
      return inner ? `<p>${inner}</p>` : '';
    }
    case 'list':
      return listToHtml(el, styleProps, listStyles);
    case 'table':
      return tableToHtml(el, styleProps);
    default:
      return '';
  }
}

function findOfficeText(root: Element): Element | null {
  const bodies = root.getElementsByTagName('office:body');
  if (bodies.length) {
    const body = bodies[0];
    for (let i = 0; i < body.childNodes.length; i++) {
      const child = body.childNodes[i];
      if (child.nodeType === 1 && localName(child as Element) === 'text') {
        return child as Element;
      }
    }
  }

  const textNodes = root.getElementsByTagName('office:text');
  return textNodes.length ? (textNodes[0] as Element) : null;
}

function odfBodyToHtml(contentXml: string, stylesXml: string | null): string {
  const doc = new DOMParser().parseFromString(contentXml, 'text/xml');
  const officeText = findOfficeText(doc.documentElement);
  if (!officeText) {
    return '';
  }

  const styleProps = parseStyleProps(stylesXml);
  const listStyles = parseListStyles(stylesXml);
  const parts: string[] = [];

  for (let i = 0; i < officeText.childNodes.length; i++) {
    const child = officeText.childNodes[i];
    if (child.nodeType !== 1) {
      continue;
    }
    const html = blockToHtml(child as Element, styleProps, listStyles);
    if (html) {
      parts.push(html);
    }
  }

  return parts.join('\n');
}

async function readOdtParts(buf: Buffer): Promise<OdtParts> {
  const zip = await JSZip.loadAsync(buf);
  const contentFile = zip.file('content.xml');
  if (!contentFile) {
    throw new Error('ODT file is missing content.xml');
  }

  const contentXml = await contentFile.async('text');
  const stylesFile = zip.file('styles.xml');
  const stylesXml = stylesFile ? await stylesFile.async('text') : null;

  return { contentXml, stylesXml };
}

export async function convertOdtToMd(buf: Buffer): Promise<string> {
  const { contentXml, stylesXml } = await readOdtParts(buf);
  const html = odfBodyToHtml(contentXml, stylesXml);
  return createTurndownService().turndown(html || '<p></p>') + '\n';
}
