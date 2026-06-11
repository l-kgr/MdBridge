import mammoth from 'mammoth';
import TurndownService from 'turndown';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { createTurndownService } from './turndownConfig';

export async function convertDocxToMd(buf: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer: buf });

  if (result.messages.length) {
    console.log('mammoth warnings:', result.messages);
  }

  return createTurndownService().turndown(result.value) + '\n';
}

interface DocxCommentMeta {
  author: string | null;
  date: string | null;
  initials: string | null;
  body: string;
}

interface ParsedCommentRef {
  commentId: string;
  label: string;
  body: string;
}

function localName(el: Element): string {
  return el.localName ?? el.tagName.split(':').pop() ?? el.tagName;
}

function collectText(element: Element): string {
  const parts: string[] = [];
  const texts = element.getElementsByTagName('w:t');
  for (let i = 0; i < texts.length; i++) {
    parts.push(texts[i].textContent ?? '');
  }
  return parts.join('');
}

function parseCommentsXml(xml: string): Map<string, DocxCommentMeta> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const comments = new Map<string, DocxCommentMeta>();
  const nodes = doc.getElementsByTagName('w:comment');

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const id = el.getAttribute('w:id');
    if (!id) {
      continue;
    }

    comments.set(id, {
      author: el.getAttribute('w:author')?.trim() || null,
      date: el.getAttribute('w:date')?.trim() || null,
      initials: el.getAttribute('w:initials')?.trim() || null,
      body: collectText(el).trim()
    });
  }

  return comments;
}

function extractCommentRanges(documentXml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(documentXml, 'text/xml');
  const ranges = new Map<string, string>();
  const active = new Map<string, string>();

  function walk(node: Node): void {
    if (node.nodeType !== 1) {
      return;
    }

    const el = node as Element;
    const name = localName(el);

    if (name === 'commentRangeStart') {
      const id = el.getAttribute('w:id');
      if (id) {
        active.set(id, '');
      }
    } else if (name === 'commentRangeEnd') {
      const id = el.getAttribute('w:id');
      if (id) {
        const text = active.get(id)?.trim();
        if (text) {
          ranges.set(id, text);
        }
        active.delete(id);
      }
    } else if (name === 't') {
      const text = el.textContent ?? '';
      for (const [id, partial] of active) {
        active.set(id, partial + text);
      }
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]);
    }
  }

  walk(doc.documentElement);
  return ranges;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCommentRefsFromHtml(dlHtml: string, td: TurndownService): ParsedCommentRef[] {
  const refs: ParsedCommentRef[] = [];
  const dtPattern = /<dt[^>]*id="comment-([^"]+)"[^>]*>Comment \[([^\]]+)\]<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
  let match: RegExpExecArray | null;

  while ((match = dtPattern.exec(dlHtml)) !== null) {
    const bodyHtml = match[3].replace(/<a[^>]*href="#comment-ref-[^"]*"[^>]*>↑<\/a>/g, '').trim();
    refs.push({
      commentId: match[1],
      label: match[2],
      body: td.turndown(bodyHtml).replace(/\s+/g, ' ').trim()
    });
  }

  return refs;
}

function formatCommentDefinition(
  ref: ParsedCommentRef,
  meta: DocxCommentMeta | undefined,
  body: string
): string {
  const author = meta?.author ?? (ref.label.replace(/\d+$/, '') || null);
  const date = meta?.date;
  const header = [author ? `**${author}**` : null, date ? `(${date})` : null]
    .filter(Boolean)
    .join(' ');

  return header ? `[^${ref.label}]: ${header}: ${body}` : `[^${ref.label}]: ${body}`;
}

function wrapCommentedRanges(
  markdown: string,
  ranges: Map<string, string>,
  idToLabel: Map<string, string>
): string {
  let result = markdown;

  for (const [id, text] of ranges) {
    const label = idToLabel.get(id);
    if (!label || !text) {
      continue;
    }

    const footnoteRef = `[^${label}]`;
    const wrapped = `⟦${text}⟧${footnoteRef}`;
    const pattern = new RegExp(
      `${escapeRegExp(text)}(\\s*${escapeRegExp(footnoteRef)})`
    );

    if (pattern.test(result)) {
      result = result.replace(pattern, wrapped);
    }
  }

  return result;
}

async function readDocxParts(buf: Buffer): Promise<{
  commentMeta: Map<string, DocxCommentMeta>;
  commentRanges: Map<string, string>;
}> {
  const zip = await JSZip.loadAsync(buf);
  const commentsFile = zip.file('word/comments.xml');
  const documentFile = zip.file('word/document.xml');

  const commentMeta = commentsFile
    ? parseCommentsXml(await commentsFile.async('text'))
    : new Map<string, DocxCommentMeta>();

  const commentRanges = documentFile
    ? extractCommentRanges(await documentFile.async('text'))
    : new Map<string, string>();

  return { commentMeta, commentRanges };
}

const COMMENT_REF_PREFIX = '\uE000COMMENTREF:';
const COMMENT_REF_SUFFIX = '\uE001';

function commentRefPlaceholder(label: string): string {
  return `${COMMENT_REF_PREFIX}${label}${COMMENT_REF_SUFFIX}`;
}

function restoreCommentRefs(markdown: string): string {
  return markdown.replace(
    new RegExp(`${COMMENT_REF_PREFIX}([^${COMMENT_REF_SUFFIX}]+)${COMMENT_REF_SUFFIX}`, 'g'),
    '[^$1]'
  );
}

function convertCommentHtmlToMarkdownWithRanges(
  html: string,
  commentMeta: Map<string, DocxCommentMeta>,
  commentRanges: Map<string, string>
): string {
  const dlMatch = html.match(/<dl>[\s\S]*<\/dl>/);
  const bodyHtml = dlMatch?.index !== undefined ? html.slice(0, dlMatch.index) : html;
  const dlHtml = dlMatch?.[0] ?? '';
  const td = createTurndownService();

  const bodyWithPlaceholders = bodyHtml.replace(
    /<sup><a[^>]*href="#comment-[^"]*"[^>]*id="comment-ref-[^"]*"[^>]*>\[([^\]]+)\]<\/a><\/sup>/g,
    (_match, label: string) => commentRefPlaceholder(label)
  );

  let markdown = restoreCommentRefs(td.turndown(bodyWithPlaceholders).trim());
  const refs = parseCommentRefsFromHtml(dlHtml, td);

  if (!refs.length) {
    return markdown + '\n';
  }

  const idToLabel = new Map(refs.map((ref) => [ref.commentId, ref.label]));

  if (commentRanges.size) {
    markdown = wrapCommentedRanges(markdown, commentRanges, idToLabel);
  }

  const definitions = refs.map((ref) => {
    const meta = commentMeta.get(ref.commentId);
    const body = ref.body || meta?.body || '';
    return formatCommentDefinition(ref, meta, body);
  });

  return `${markdown}\n\n## Comments\n\n${definitions.join('\n\n')}\n`;
}

export async function convertDocxToMdWithComments(buf: Buffer): Promise<string> {
  const [{ commentMeta, commentRanges }, result] = await Promise.all([
    readDocxParts(buf),
    mammoth.convertToHtml(
      { buffer: buf },
      { styleMap: 'comment-reference => sup' }
    )
  ]);

  if (result.messages.length) {
    console.log('mammoth warnings:', result.messages);
  }

  return convertCommentHtmlToMarkdownWithRanges(result.value, commentMeta, commentRanges);
}
