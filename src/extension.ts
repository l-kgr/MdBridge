import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { convertMsgToMd } from './converters/msgToMd';
import { convertDocxToMd, convertDocxToMdWithComments } from './converters/docxToMd';
import { convertMdToDocx } from './converters/mdToDocx';
import { convertMdToRichClipboard } from './converters/mdToHtml';
import { convertPptxToMd } from './converters/pptxToMd';
import { convertOdtToMd } from './converters/odtToMd';
import { convertMdToOdt } from './converters/mdToOdt';
import { convertOdpToMd } from './converters/odpToMd';
import { copyRichTextToClipboard } from './utils/clipboardRichText';
import { getCollisionSafeFilePath, getOutputPath, writeOutput } from './utils/fileHelpers';
import { resolveCommandUri } from './utils/resolveCommandUri';

export function activate(context: vscode.ExtensionContext) {
  const wrap = (
    command: string,
    inputExt: string,
    outputExt: string,
    converter: (buf: Buffer) => Promise<string>
  ) =>
    vscode.commands.registerCommand(`mdbridge.${command}`, async (uri?: vscode.Uri) => {
      const resolved = await resolveCommandUri(uri, inputExt);
      if (!resolved) {
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `MdBridge: converting ${resolved.fsPath.split(/[/\\]/).pop()}…`
        },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(resolved));
            const md = await converter(buf);
            const outPath = getOutputPath(resolved.fsPath, outputExt);
            await writeOutput(outPath, md);
            const doc = await vscode.workspace.openTextDocument(outPath);
            await vscode.window.showTextDocument(doc);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MdBridge error: ${message}`);
          }
        }
      );
    });

  context.subscriptions.push(
    wrap('docxToMd', '.docx', '.md', convertDocxToMd),
    wrap('docxToMdWithComments', '.docx', '.md', convertDocxToMdWithComments),
    wrap('odtToMd', '.odt', '.md', convertOdtToMd),
    wrap('pptxToMd', '.pptx', '.md', convertPptxToMd),
    wrap('odpToMd', '.odp', '.md', convertOdpToMd),

    vscode.commands.registerCommand('mdbridge.msgToMd', async (uri?: vscode.Uri) => {
      const resolved = await resolveCommandUri(uri, '.msg');
      if (!resolved) {
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `MdBridge: converting ${resolved.fsPath.split(/[/\\]/).pop()}…`
        },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(resolved));
            const result = await convertMsgToMd(buf);
            const outPath = getOutputPath(resolved.fsPath, '.md');
            await writeOutput(outPath, result.markdown);

            const extractAttachments = vscode.workspace
              .getConfiguration('mdbridge')
              .get<boolean>('extractMsgAttachments', false);

            if (extractAttachments && result.attachments.length > 0) {
              const attachDir = path.join(
                path.dirname(outPath),
                `${path.basename(outPath, '.md')}_attachments`
              );
              await fs.promises.mkdir(attachDir, { recursive: true });
              for (const attachment of result.attachments) {
                const attachPath = getCollisionSafeFilePath(attachDir, attachment.fileName);
                await writeOutput(attachPath, attachment.content);
              }
            }

            const doc = await vscode.workspace.openTextDocument(outPath);
            await vscode.window.showTextDocument(doc);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MdBridge error: ${message}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('mdbridge.mdToDocx', async (uri?: vscode.Uri) => {
      const resolved = await resolveCommandUri(uri, '.md');
      if (!resolved) {
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'MdBridge: exporting to DOCX…' },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(resolved));
            const docxBuf = await convertMdToDocx(buf.toString('utf-8'));
            const outPath = getOutputPath(resolved.fsPath, '.docx');
            await writeOutput(outPath, docxBuf);
            vscode.window.showInformationMessage(`MdBridge: saved → ${outPath}`);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MdBridge error: ${message}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('mdbridge.mdToOdt', async (uri?: vscode.Uri) => {
      const resolved = await resolveCommandUri(uri, '.md');
      if (!resolved) {
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'MdBridge: exporting to ODT…' },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(resolved));
            const odtBuf = await convertMdToOdt(buf.toString('utf-8'));
            const outPath = getOutputPath(resolved.fsPath, '.odt');
            await writeOutput(outPath, odtBuf);
            vscode.window.showInformationMessage(`MdBridge: saved → ${outPath}`);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MdBridge error: ${message}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('mdbridge.copyMdAsDocxFormat', async (uri?: vscode.Uri) => {
      const resolved = await resolveCommandUri(uri, '.md');
      if (!resolved) {
        return;
      }
      try {
        const buf = Buffer.from(await vscode.workspace.fs.readFile(resolved));
        const markdown = buf.toString('utf-8');
        const { html, plainText } = convertMdToRichClipboard(markdown);
        await copyRichTextToClipboard(html, plainText);
        const fileName = resolved.fsPath.split(/[/\\]/).pop() ?? 'file';
        vscode.window.showInformationMessage(
          `MdBridge: copied rich text from ${fileName} — paste into Word or email.`
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`MdBridge error: ${message}`);
      }
    })
  );
}

export function deactivate() {}
