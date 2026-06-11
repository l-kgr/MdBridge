import JSZip from 'jszip';
import {
  InlineSpan,
  MarkdownBlock,
  normalizeRowCells,
  parseInlineSpans,
  parseMarkdownToBlocks
} from './markdownBlocks';

const ODF_NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
  meta: 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  dc: 'http://purl.org/dc/elements/1.1/'
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function spansToOdf(spans: InlineSpan[]): string {
  return spans
    .map((span) => {
      const text = escapeXml(span.text);
      if (!text) {
        return '';
      }

      let styleName: string | null = null;
      if (span.code) {
        styleName = 'MdBridgeCode';
      } else if (span.bold && span.italics) {
        styleName = 'MdBridgeBoldItalic';
      } else if (span.bold) {
        styleName = 'MdBridgeBold';
      } else if (span.italics) {
        styleName = 'MdBridgeItalic';
      }

      if (span.link) {
        const inner = styleName
          ? `<text:span text:style-name="${styleName}">${text}</text:span>`
          : text;
        return `<text:a xlink:type="simple" xlink:href="${escapeXml(span.link)}">${inner}</text:a>`;
      }

      if (styleName) {
        return `<text:span text:style-name="${styleName}">${text}</text:span>`;
      }
      return text;
    })
    .join('');
}

function paragraphXml(text: string, styleName = 'Standard'): string {
  const content = spansToOdf(parseInlineSpans(text));
  return `<text:p text:style-name="${styleName}">${content || ' '}</text:p>`;
}

function blockToOdfXml(block: MarkdownBlock): string {
  switch (block.type) {
    case 'empty':
      return '<text:p text:style-name="Standard"/>';
    case 'heading':
      return `<text:h text:style-name="Heading_20_${block.level}" text:outline-level="${block.level}">${spansToOdf(parseInlineSpans(block.text))}</text:h>`;
    case 'paragraph':
      return paragraphXml(block.text);
    case 'list': {
      const listStyle = block.ordered ? 'MdBridgeOrderedList' : 'MdBridgeBulletList';
      const items = block.items
        .map((item) => `<text:list-item>${paragraphXml(item)}</text:list-item>`)
        .join('');
      return `<text:list text:style-name="${listStyle}">${items}</text:list>`;
    }
    case 'code':
      return `<text:p text:style-name="MdBridgeCodeBlock">${escapeXml(block.text)}</text:p>`;
    case 'table': {
      const columnCount = block.headers.length;
      const headerRow = `<table:table-row>${normalizeRowCells(block.headers, columnCount)
        .map((cell) => `<table:table-cell><text:p text:style-name="MdBridgeTableHeader">${spansToOdf(parseInlineSpans(cell))}</text:p></table:table-cell>`)
        .join('')}</table:table-row>`;
      const bodyRows = block.rows
        .map(
          (row) =>
            `<table:table-row>${normalizeRowCells(row, columnCount)
              .map((cell) => `<table:table-cell>${paragraphXml(cell)}</table:table-cell>`)
              .join('')}</table:table-row>`
        )
        .join('');
      return `<table:table table:name="Table1" table:style-name="MdBridgeTable">${headerRow}${bodyRows}</table:table>`;
    }
  }
}

function buildContentXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${ODF_NS.office}"
 xmlns:text="${ODF_NS.text}"
 xmlns:table="${ODF_NS.table}"
 xmlns:style="${ODF_NS.style}"
 xmlns:fo="${ODF_NS.fo}"
 xmlns:xlink="${ODF_NS.xlink}"
 office:version="1.3">
 <office:automatic-styles>
  <style:style style:name="MdBridgeBold" style:family="text">
   <style:text-properties fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="MdBridgeItalic" style:family="text">
   <style:text-properties fo:font-style="italic"/>
  </style:style>
  <style:style style:name="MdBridgeBoldItalic" style:family="text">
   <style:text-properties fo:font-weight="bold" fo:font-style="italic"/>
  </style:style>
  <style:style style:name="MdBridgeCode" style:family="text">
   <style:text-properties fo:font-name="Consolas"/>
  </style:style>
  <style:style style:name="MdBridgeCodeBlock" style:family="paragraph">
   <style:text-properties fo:font-name="Consolas"/>
   <style:paragraph-properties fo:background-color="#F5F5F5"/>
  </style:style>
  <style:style style:name="MdBridgeTableHeader" style:family="paragraph">
   <style:text-properties fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="MdBridgeTable" style:family="table">
   <style:table-properties table:align="margins" style:width="17cm"/>
  </style:style>
  <style:style style:name="MdBridgeBulletList" style:family="list">
   <style:list-style>
    <text:list-level-style-bullet text:level="1" text:style-name="Bullet_20_Symbols" style:num-suffix="." text:bullet-char="•"/>
   </style:list-style>
  </style:style>
  <style:style style:name="MdBridgeOrderedList" style:family="list">
   <style:list-style>
    <text:list-level-style-number text:level="1" text:style-name="Numbering_20_Symbols" style:num-format="1" text:display-labels="true"/>
   </style:list-style>
  </style:style>
 </office:automatic-styles>
 <office:body>
  <office:text>
${bodyXml}
  </office:text>
 </office:body>
</office:document-content>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${ODF_NS.office}"
 xmlns:style="${ODF_NS.style}"
 xmlns:text="${ODF_NS.text}"
 xmlns:fo="${ODF_NS.fo}"
 office:version="1.3">
 <office:styles>
  <style:default-style style:family="paragraph">
   <style:text-properties fo:font-name="Liberation Serif" style:font-name-asian="DejaVu Sans" style:font-name-complex="DejaVu Sans"/>
  </style:default-style>
  <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  <style:style style:name="Heading_20_1" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="24pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Heading_20_2" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Heading_20_3" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Heading_20_4" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Heading_20_5" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="11pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Heading_20_6" style:family="paragraph" style:parent-style-name="Standard">
   <style:text-properties fo:font-size="10pt" fo:font-weight="bold"/>
  </style:style>
 </office:styles>
</office:document-styles>`;
}

function buildMetaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${ODF_NS.office}"
 xmlns:meta="${ODF_NS.meta}"
 xmlns:dc="${ODF_NS.dc}"
 office:version="1.3">
 <office:meta>
  <meta:generator>MdBridge</meta:generator>
  <dc:title></dc:title>
 </office:meta>
</office:document-meta>`;
}

function buildManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="${ODF_NS.manifest}">
 <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>
 <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
 <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
 <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;
}

export async function convertMdToOdt(markdown: string): Promise<Buffer> {
  const blocks = parseMarkdownToBlocks(markdown);
  const bodyXml = blocks.map((block) => `   ${blockToOdfXml(block)}`).join('\n');
  const contentXml = buildContentXml(bodyXml);

  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', buildManifestXml());
  zip.file('content.xml', contentXml);
  zip.file('styles.xml', buildStylesXml());
  zip.file('meta.xml', buildMetaXml());

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    platform: 'UNIX'
  });

  return buffer;
}
