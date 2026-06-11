import * as fs from 'fs';
import * as path from 'path';

const fixturesRoot = path.join(__dirname, '..', 'fixtures');

export function loadFixtureText(...segments: string[]): string {
  return fs.readFileSync(path.join(fixturesRoot, ...segments), 'utf-8');
}

export function loadFixtureBuffer(...segments: string[]): Buffer {
  return fs.readFileSync(path.join(fixturesRoot, ...segments));
}

export function loadSampleMarkdown(): string {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'sample', 'md-bridge_sample.md'), 'utf-8');
}
