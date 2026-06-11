import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getCollisionSafeFilePath,
  getOutputPath,
  writeOutput
} from '../../src/utils/fileHelpers';

describe('fileHelpers', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('getCollisionSafeFilePath returns original when no collision', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    const result = getCollisionSafeFilePath(tempDir, 'output.md');
    expect(result).toBe(path.join(tempDir, 'output.md'));
  });

  it('getCollisionSafeFilePath appends _1, _2 on collision', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    fs.writeFileSync(path.join(tempDir, 'output.md'), 'existing');
    fs.writeFileSync(path.join(tempDir, 'output_1.md'), 'existing');

    expect(getCollisionSafeFilePath(tempDir, 'output.md')).toBe(
      path.join(tempDir, 'output_2.md')
    );
  });

  it('getOutputPath swaps extension without collision', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    const input = path.join(tempDir, 'report.docx');
    fs.writeFileSync(input, 'docx');

    expect(getOutputPath(input, '.md')).toBe(path.join(tempDir, 'report.md'));
  });

  it('getOutputPath handles extension collisions', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    const input = path.join(tempDir, 'report.docx');
    fs.writeFileSync(input, 'docx');
    fs.writeFileSync(path.join(tempDir, 'report.md'), 'md');

    expect(getOutputPath(input, '.md')).toBe(path.join(tempDir, 'report_1.md'));
  });

  it('writeOutput writes string content', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    const filePath = path.join(tempDir, 'out.txt');
    await writeOutput(filePath, 'hello');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello');
  });

  it('writeOutput writes Buffer content', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdbridge-test-'));
    const filePath = path.join(tempDir, 'out.bin');
    await writeOutput(filePath, Buffer.from([1, 2, 3]));
    expect(fs.readFileSync(filePath)).toEqual(Buffer.from([1, 2, 3]));
  });
});
