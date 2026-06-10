import * as vscode from 'vscode';
import { convertMsgToMd } from './converters/msgToMd';
import { convertDocxToMd, convertDocxToMdWithComments } from './converters/docxToMd';
import { convertMdToDocx } from './converters/mdToDocx';
import { convertPptxToMd } from './converters/pptxToMd';
import { writeOutput, getOutputPath } from './utils/fileHelpers';

export function activate(context: vscode.ExtensionContext) {
  const wrap = (
    label: string,
    ext: string,
    converter: (buf: Buffer) => Promise<string>
  ) =>
    vscode.commands.registerCommand(`mdbridge.${label}`, async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('MdBridge: right-click a file in Explorer to convert.');
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `MdBridge: converting ${uri.fsPath.split(/[/\\]/).pop()}…`
        },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(uri));
            const md = await converter(buf);
            const outPath = getOutputPath(uri.fsPath, ext);
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
    wrap('msgToMd', '.md', convertMsgToMd),
    wrap('docxToMd', '.md', convertDocxToMd),
    wrap('docxToMdWithComments', '.md', convertDocxToMdWithComments),
    wrap('pptxToMd', '.md', convertPptxToMd),

    vscode.commands.registerCommand('mdbridge.mdToDocx', async (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'MdBridge: exporting to DOCX…' },
        async () => {
          try {
            const buf = Buffer.from(await vscode.workspace.fs.readFile(uri));
            const docxBuf = await convertMdToDocx(buf.toString('utf-8'));
            const outPath = getOutputPath(uri.fsPath, '.docx');
            await writeOutput(outPath, docxBuf);
            vscode.window.showInformationMessage(`MdBridge: saved → ${outPath}`);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MdBridge error: ${message}`);
          }
        }
      );
    })
  );
}

export function deactivate() {}
