import * as fs from 'fs';
import * as path from 'path';

export function getOutputPath(inputPath: string, newExt: string): string {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  let candidate = path.join(dir, `${base}${newExt}`);
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}_${i}${newExt}`);
    i++;
  }
  return candidate;
}

export async function writeOutput(filePath: string, content: string | Buffer): Promise<void> {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  fs.writeFileSync(filePath, buf);
}
