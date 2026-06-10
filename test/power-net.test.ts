import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

const fixtureDir = () => mkdtempSync(join(tmpdir(), 'mfn-power-'));

describe('wait / base / http', () => {
  it('wait succeeds immediately for an existing file', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'ready.flag'), '');
    const r = runIn(dir, 'wait', '-f', 'ready.flag', '--json');
    expect(r.json.ready).toBe(true);
  });

  it('wait times out (exit 1) for a port nobody listens on', () => {
    const r = run('wait', '-p', '59999', '-t', '1', '--interval', '200', '--json');
    expect(r.code).toBe(1);
    expect(r.json.error).toBe('Timeout');
  });

  it('wait rejects two targets with exit 2', () => {
    const r = run('wait', '-p', '80', '-f', 'x', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidTarget');
  });

  it('base converts hex exactly, beyond 2^53', () => {
    const r = run('base', '0xffffffffffffffff', '--json');
    expect(r.json.dec).toBe('18446744073709551615');
    expect(r.json.bits).toBe(64);
  });

  it('base rejects invalid digits for the base with exit 2', () => {
    const r = run('base', '0b102', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidNumber');
  });

  it('http fails cleanly (JSON envelope) when nothing is listening', () => {
    const r = run('http', 'http://127.0.0.1:59998', '-t', '2', '--json');
    expect(r.code).toBe(1);
    expect(r.json.ok).toBe(false);
    expect(r.json.error).toBe('RequestFailed');
  });
});

describe('ports / size / ext / ip', () => {
  it('ports returns a structured listener list', () => {
    const r = run('ports', '--json');
    expect(r.json.ok).toBe(true);
    expect(Array.isArray(r.json.listeners)).toBe(true);
  });

  it('size finds the largest file', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'big.bin'), 'x'.repeat(5000));
    writeFileSync(join(dir, 'small.txt'), 'x');
    const r = runIn(dir, 'size', '--json');
    expect(r.json.largestFiles[0].path).toBe('big.bin');
    expect(r.json.totalBytes).toBe(5001);
  });

  it('ext tallies files per extension', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'a.ts'), '');
    writeFileSync(join(dir, 'b.ts'), '');
    writeFileSync(join(dir, 'c.md'), '');
    const r = runIn(dir, 'ext', '--json');
    const ts = r.json.extensions.find((e: any) => e.ext === '.ts');
    expect(ts.count).toBe(2);
  });

  it('ip reports interfaces with a stable shape', () => {
    const r = run('ip', '-a', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.interfaces.length).toBeGreaterThan(0);
  });
});
