import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel,
  WidthType
} from 'docx';
import {
  HeadingLevel as MdHeadingLevel,
  InlineSpan,
  MarkdownBlock,
  normalizeRowCells,
  parseInlineSpans,
  parseMarkdownToBlocks
} from './markdownBlocks';

type DocxBlock = Paragraph | Table;

const ORDERED_LIST_REF = 'mdbridge-ordered';

const HEADING_LEVEL_MAP: Record<MdHeadingLevel, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
};

function spanToRun(span: InlineSpan, forceBold = false): TextRun {
  return new TextRun({
    text: span.text,
    bold: forceBold || span.bold,
    italics: span.italics,
    font: span.code ? 'Consolas' : undefined
  });
}

function inlineSpansToChildren(spans: InlineSpan[], forceBold = false): (TextRun | ExternalHyperlink)[] {
  return spans.map((span) => {
    const run = spanToRun(span, forceBold);
    if (span.link) {
      return new ExternalHyperlink({ children: [run], link: span.link });
    }
    return run;
  });
}

function paragraphFromText(text: string, bold = false): Paragraph {
  return new Paragraph({ children: inlineSpansToChildren(parseInlineSpans(text), bold) });
}

function blockToDocx(block: MarkdownBlock): DocxBlock | DocxBlock[] {
  switch (block.type) {
    case 'empty':
      return new Paragraph({ text: '' });
    case 'heading':
      return new Paragraph({
        heading: HEADING_LEVEL_MAP[block.level],
        children: inlineSpansToChildren(parseInlineSpans(block.text))
      });
    case 'paragraph':
      return paragraphFromText(block.text);
    case 'list':
      return block.items.map((item) =>
        new Paragraph({
          ...(block.ordered
            ? { numbering: { reference: ORDERED_LIST_REF, level: 0 } }
            : { bullet: { level: 0 } }),
          children: inlineSpansToChildren(parseInlineSpans(item))
        })
      );
    case 'code':
      return new Paragraph({
        children: [new TextRun({ text: block.text, font: 'Consolas' })],
        shading: { fill: 'F5F5F5' }
      });
    case 'table': {
      const columnCount = block.headers.length;
      const rows: TableRow[] = [
        new TableRow({
          children: normalizeRowCells(block.headers, columnCount).map(
            (cell) =>
              new TableCell({
                children: [paragraphFromText(cell, true)]
              })
          )
        }),
        ...block.rows.map(
          (row) =>
            new TableRow({
              children: normalizeRowCells(row, columnCount).map(
                (cell) =>
                  new TableCell({
                    children: [paragraphFromText(cell)]
                  })
              )
            })
        )
      ];

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'auto' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'auto' }
        }
      });
    }
  }
}

export async function convertMdToDocx(markdown: string): Promise<Buffer> {
  const children = parseMarkdownToBlocks(markdown).flatMap((block) => {
    const result = blockToDocx(block);
    return Array.isArray(result) ? result : [result];
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT
            }
          ]
        }
      ]
    },
    sections: [{ properties: {}, children }]
  });

  return await Packer.toBuffer(doc);
}
