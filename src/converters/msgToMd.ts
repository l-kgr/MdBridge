import MsgReader from '@kenjiuno/msgreader';
import TurndownService from 'turndown';

export async function convertMsgToMd(buf: Buffer): Promise<string> {
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

  const attachmentList = (data.attachments ?? [])
    .map((a: { fileName?: string }) => `- ${a.fileName}`)
    .join('\n');

  const frontmatter = [
    '---',
    `from: "${data.senderName ?? ''}"`,
    `to: "${recipients}"`,
    `subject: "${data.subject ?? ''}"`,
    `date: "${data.messageDeliveryTime ?? ''}"`,
    data.attachments?.length
      ? `attachments:\n${attachmentList.split('\n').map((l) => '  ' + l).join('\n')}`
      : null,
    '---'
  ]
    .filter(Boolean)
    .join('\n');

  return `${frontmatter}\n\n${body}\n`;
}
