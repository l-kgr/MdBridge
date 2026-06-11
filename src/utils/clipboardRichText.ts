import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function pipeToProcess(command: string, args: string[], data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
    proc.stdin.write(data, 'utf8');
    proc.stdin.end();
  });
}

function padOffset(value: number): string {
  return value.toString().padStart(10, '0');
}

export function buildCfHtml(fragment: string): string {
  const startMarker = '<!--StartFragment-->';
  const endMarker = '<!--EndFragment-->';
  const markup = `<html><body>${startMarker}${fragment}${endMarker}</body></html>`;
  const placeholder =
    'Version:1.0\r\n' +
    'StartHTML:0000000000\r\n' +
    'EndHTML:0000000000\r\n' +
    'StartFragment:0000000000\r\n' +
    'EndFragment:0000000000\r\n';

  const startHtml = Buffer.byteLength(placeholder, 'utf8');
  const endHtml = startHtml + Buffer.byteLength(markup, 'utf8');
  const startFragment = startHtml + Buffer.byteLength(`<html><body>${startMarker}`, 'utf8');
  const endFragment = startHtml + Buffer.byteLength(`<html><body>${startMarker}${fragment}`, 'utf8');

  const header =
    'Version:1.0\r\n' +
    `StartHTML:${padOffset(startHtml)}\r\n` +
    `EndHTML:${padOffset(endHtml)}\r\n` +
    `StartFragment:${padOffset(startFragment)}\r\n` +
    `EndFragment:${padOffset(endFragment)}\r\n`;

  return header + markup;
}

async function copyHtmlWindows(cfHtml: string, plainText: string): Promise<void> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mdbridge-clip-'));
  const htmlPath = path.join(tempDir, 'clip.html');
  const plainPath = path.join(tempDir, 'clip.txt');
  const scriptPath = path.join(tempDir, 'clip.ps1');

  try {
    await fs.promises.writeFile(htmlPath, cfHtml, 'utf8');
    await fs.promises.writeFile(plainPath, plainText, 'utf8');
    await fs.promises.writeFile(
      scriptPath,
      [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$data = New-Object System.Windows.Forms.DataObject',
        `$html = Get-Content -LiteralPath '${htmlPath.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
        `$plain = Get-Content -LiteralPath '${plainPath.replace(/'/g, "''")}' -Raw -Encoding UTF8`,
        '$data.SetData("HTML Format", $html)',
        '$data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $plain)',
        '[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)'
      ].join('\n'),
      'utf8'
    );

    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true }
    );
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function copyHtmlDarwin(cfHtml: string, plainText: string): Promise<void> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mdbridge-clip-'));
  const htmlPath = path.join(tempDir, 'clip.html');

  try {
    await fs.promises.writeFile(htmlPath, cfHtml, 'utf8');
    await pipeToProcess('pbcopy', [], plainText);
    await execFileAsync('osascript', [
      '-e',
      `set the clipboard to (read POSIX file "${htmlPath}" as «class utf8»)`
    ]);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function copyHtmlLinux(cfHtml: string, plainText: string): Promise<void> {
  try {
    await pipeToProcess('xclip', ['-selection', 'clipboard', '-t', 'text/html'], cfHtml);
    await pipeToProcess('xclip', ['-selection', 'clipboard', '-t', 'text/plain'], plainText);
    return;
  } catch {
    // fall through to wl-copy
  }

  await pipeToProcess('wl-copy', ['--type', 'text/html'], cfHtml);
  await pipeToProcess('wl-copy', ['--type', 'text/plain'], plainText);
}

export async function copyRichTextToClipboard(html: string, plainText: string): Promise<void> {
  const cfHtml = buildCfHtml(html);
  const platform = process.platform;

  if (platform === 'win32') {
    await copyHtmlWindows(cfHtml, plainText);
    return;
  }

  if (platform === 'darwin') {
    await copyHtmlDarwin(cfHtml, plainText);
    return;
  }

  await copyHtmlLinux(cfHtml, plainText);
}
