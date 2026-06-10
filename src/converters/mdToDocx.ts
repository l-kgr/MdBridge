import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

function parseLine(line: string): Paragraph {
  const h1 = line.match(/^# (.+)/);
  const h2 = line.match(/^## (.+)/);
  const h3 = line.match(/^### (.+)/);

  if (h1) {
    return new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1 });
  }
  if (h2) {
    return new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 });
  }
  if (h3) {
    return new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 });
  }

  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    if (m[2]) {
      runs.push(new TextRun({ text: m[2], bold: true, italics: true }));
    } else if (m[3]) {
      runs.push(new TextRun({ text: m[3], bold: true }));
    } else if (m[4]) {
      runs.push(new TextRun({ text: m[4], italics: true }));
    } else if (m[5]) {
      runs.push(new TextRun({ text: m[5] }));
    }
  }

  return new Paragraph({ children: runs.length ? runs : [new TextRun(line)] });
}

export async function convertMdToDocx(markdown: string): Promise<Buffer> {
  const stripped = markdown.replace(/^---[\s\S]*?---\n/, '').trim();
  const lines = stripped.split('\n');

  const paragraphs: Paragraph[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else {
      paragraphs.push(parseLine(line));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }]
  });

  return await Packer.toBuffer(doc);
}
