import MsgReader from '@kenjiuno/msgreader';
import TurndownService from 'turndown';

export interface MsgAttachment {
  fileName: string;
  content: Buffer;
}

export interface MsgConversionResult {
  markdown: string;
  attachments: MsgAttachment[];
}

function yamlQuote(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`;
}

function formatAttachmentFrontmatter(files: string[]): string | null {
  if (!files.length) {
    return null;
  }
  return `attachments:\n${files.map((file) => `  - ${yamlQuote(file)}`).join('\n')}`;
}

export async function convertMsgToMd(buf: Buffer): Promise<MsgConversionResult> {
  const reader = new MsgReader(new DataView(buf.buffer, buf.byteOffset, buf.byteLength));
  const data = reader.getFileData();

  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

  let body = '';
  if (data.bodyHtml) {
    body = td.turndown(data.bodyHtml);
  } else if (data.body) {
    body = data.body.trim();
  }

  const recipients = (data.recipients ?? [])
    .map((r: { name?: string; email?: string }) => r.name ?? r.email ?? '')
    .filter(Boolean)
    .join(', ');

  const attachments: MsgAttachment[] = [];
  const attachmentNames: string[] = [];

  for (const att of data.attachments ?? []) {
    const extracted = reader.getAttachment(att);
    attachments.push({
      fileName: extracted.fileName,
      content: Buffer.from(extracted.content)
    });
    attachmentNames.push(extracted.fileName);
  }

  const frontmatter = [
    '---',
    `from: ${yamlQuote(data.senderName ?? '')}`,
    `to: ${yamlQuote(recipients)}`,
    `subject: ${yamlQuote(data.subject ?? '')}`,
    `date: ${yamlQuote(data.messageDeliveryTime ?? '')}`,
    formatAttachmentFrontmatter(attachmentNames),
    '---'
  ]
    .filter(Boolean)
    .join('\n');

  return {
    markdown: `${frontmatter}\n\n${body}\n`,
    attachments
  };
}
