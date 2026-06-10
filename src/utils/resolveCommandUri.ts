import * as vscode from 'vscode';

export const MISSING_URI_MESSAGE =
  'MdBridge: no file selected. Open a supported file in the editor or choose one from the file picker.';

export async function resolveCommandUri(
  uri: vscode.Uri | undefined,
  extension: string
): Promise<vscode.Uri | undefined> {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;

  if (uri?.fsPath.toLowerCase().endsWith(ext)) {
    return uri;
  }

  const editor = vscode.window.activeTextEditor;
  if (
    editor?.document.uri.scheme === 'file' &&
    editor.document.uri.fsPath.toLowerCase().endsWith(ext)
  ) {
    return editor.document.uri;
  }

  const label = ext.slice(1).toUpperCase();
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select file',
    filters: { [label]: [ext.slice(1)] }
  });

  if (picked?.[0]) {
    return picked[0];
  }

  vscode.window.showErrorMessage(MISSING_URI_MESSAGE);
  return undefined;
}
