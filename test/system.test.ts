import { describe, it, expect } from 'vitest';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

describe('port', () => {
  it('returns a numeric free port', () => {
    const r = run('port', '--json');
    expect(r.json.ok).toBe(true);
    expect(typeof r.json.port).toBe('number');
    expect(r.json.port).toBeGreaterThan(0);
  });

  it('-c reports an IPv4-only-occupied port as unavailable (dual-stack probe)', async () => {
    const PORT = 59555;
    const srv = createServer();
    await new Promise<void>((res, rej) => {
      srv.once('error', rej);
      srv.listen(PORT, '127.0.0.1', res);
    });
    try {
      const r = run('port', '-c', String(PORT), '--json');
      expect(r.json.ok).toBe(true);
      expect(r.json.available).toBe(false);
    } finally {
      await new Promise<void>((res) => srv.close(() => res()));
    }
  });

  it('-c reports a free port as available', () => {
    const free = run('port', '--json').json.port;
    const r = run('port', '-c', String(free), '--json');
    expect(r.json.available).toBe(true);
  });

  it('single and multi both expose count + ports (stable shape)', () => {
    const one = run('port', '--json');
    expect(one.json.count).toBe(1);
    expect(Array.isArray(one.json.ports)).toBe(true);
    expect(one.json.port).toBe(one.json.ports[0]);
  });
});

describe('kill', () => {
  it('rejects an out-of-range port with exit 2 (UsageError contract)', () => {
    const r = run('kill', '-p', '99999', '--json');
    expect(r.code).toBe(2);
    expect(r.singleObject).toBe(true);
    expect(r.json.error).toBe('InvalidPort');
  });

  it('rejects a non-numeric port with exit 2', () => {
    const r = run('kill', '-p', 'abc', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidPort');
  });

  it('headless with no ports → NoPorts, exit 2 (no cache replay)', () => {
    const r = run('kill', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('NoPorts');
  });
});

/** A small fixture tree for sc/cts: src/service.ts, src/util.ts, docs/readme.md */
function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mfn-fixture-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'src', 'service.ts'), 'export const x = 1;\n');
  writeFileSync(join(dir, 'src', 'util.ts'), 'export const y = 2;\n');
  writeFileSync(join(dir, 'docs', 'readme.md'), '# hi\n');
  return dir;
}

describe('sc (fuzzy find)', () => {
  it('finds a file by fuzzy pattern with a stable JSON shape', () => {
    const dir = makeFixture();
    const r = runIn(dir, 'sc', 'service', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.count).toBeGreaterThanOrEqual(1);
    expect(r.json.matches.join(',')).toContain('service.ts');
    expect(r.json.truncated).toBe(false);
  });

  it('returns count 0 (not an error) when nothing matches', () => {
    const dir = makeFixture();
    const r = runIn(dir, 'sc', 'zzzznothing', '--json');
    expect(r.code).toBe(0);
    expect(r.json.count).toBe(0);
  });

  it('rejects a negative --limit with exit 2', () => {
    const r = run('sc', 'x', '--limit', '-1', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidLimit');
  });
});

describe('cts (directory tree)', () => {
  it('prints a text tree containing the fixture entries', () => {
    const dir = makeFixture();
    const r = runIn(dir, 'cts', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.format).toBe('text');
    expect(r.json.tree).toContain('service.ts');
    expect(r.json.tree).toContain('docs');
  });

  it('rejects out-of-range image dimensions with exit 2', () => {
    const dir = makeFixture();
    const r = runIn(dir, 'cts', '-t', 'svg', '-l', '99999', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidDimensions');
  });
});
