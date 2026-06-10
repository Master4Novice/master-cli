import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

const fixtureDir = () => mkdtempSync(join(tmpdir(), 'mfn-power-'));

describe('outline', () => {
  it('lists TS symbols with line numbers', () => {
    const dir = fixtureDir();
    writeFileSync(
      join(dir, 'a.ts'),
      'export function alpha() {}\nclass Beta {}\nexport const gamma = () => 1;\n',
    );
    const r = runIn(dir, 'outline', 'a.ts', '--json');
    const names = r.json.symbols.map((s: any) => `${s.kind}:${s.name}:${s.line}`);
    expect(names).toContain('function:alpha:1');
    expect(names).toContain('class:Beta:2');
    expect(names).toContain('const:gamma:3');
  });

  it('rejects unsupported file types with exit 2', () => {
    const r = run('outline', 'file.xyz', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('UnsupportedType');
  });
});

describe('imports', () => {
  it('groups a file’s imports into relative/packages/builtin', () => {
    const dir = fixtureDir();
    writeFileSync(
      join(dir, 'a.ts'),
      "import x from './local';\nimport y from 'lodash';\nimport z from 'node:fs';\n",
    );
    const r = runIn(dir, 'imports', 'a.ts', '--json');
    expect(r.json.relative).toEqual(['./local']);
    expect(r.json.packages).toEqual(['lodash']);
    expect(r.json.builtin).toEqual(['node:fs']);
  });

  it('--who finds importers across the tree', () => {
    const dir = fixtureDir();
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'user.ts'), "import { db } from '../shared/db';\n");
    writeFileSync(join(dir, 'src', 'other.ts'), "import fs from 'node:fs';\n");
    const r = runIn(dir, 'imports', '--who', 'shared/db', '--json');
    expect(r.json.count).toBe(1);
    expect(r.json.importers[0].file).toContain('user.ts');
  });
});

describe('replace', () => {
  it('is a dry-run by default (reports, does not modify)', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'a.txt'), 'old old old\n');
    const r = runIn(dir, 'replace', 'old', 'new', '-g', '*.txt', '--json');
    expect(r.json.mode).toBe('dry-run');
    expect(r.json.totalReplacements).toBe(3);
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('old old old\n');
  });

  it('--write applies the replacement', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'a.txt'), 'old stays old\n');
    const r = runIn(dir, 'replace', 'old', 'new', '-g', '*.txt', '-w', '--json');
    expect(r.json.mode).toBe('written');
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('new stays new\n');
  });

  it('glob ** matches nested paths', () => {
    const dir = fixtureDir();
    mkdirSync(join(dir, 'src', 'deep'), { recursive: true });
    writeFileSync(join(dir, 'src', 'deep', 'x.ts'), 'target\n');
    writeFileSync(join(dir, 'skip.md'), 'target\n');
    const r = runIn(dir, 'replace', 'target', 'hit', '-g', 'src/**/*.ts', '--json');
    expect(r.json.fileCount).toBe(1);
    expect(r.json.changes[0].file).toBe('src/deep/x.ts');
  });
});

describe('recent / pkg / dotenv', () => {
  it('recent returns newest files first', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'older.txt'), 'a');
    writeFileSync(join(dir, 'newer.txt'), 'b');
    const r = runIn(dir, 'recent', '-t', '2', '--json');
    expect(r.json.files.length).toBe(2);
    expect(r.json.files.map((f: any) => f.path)).toContain('newer.txt');
  });

  it('pkg reports declared vs installed for this repo', () => {
    const r = run('pkg', 'typescript', '--json');
    expect(r.json.deps[0].name).toBe('typescript');
    expect(r.json.deps[0].installed).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('dotenv reports missing keys without leaking values', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, '.env'), 'A=1\nSECRET_VALUE=topsecret\n');
    writeFileSync(join(dir, '.env.example'), 'A=\nB=\n');
    const r = runIn(dir, 'dotenv', '--json');
    expect(r.json.missing).toEqual(['B']);
    expect(r.json.extra).toEqual(['SECRET_VALUE']);
    expect(JSON.stringify(r.json)).not.toContain('topsecret');
  });
});
