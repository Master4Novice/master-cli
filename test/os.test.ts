import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

describe('procs', () => {
  it('lists processes with pid and command', () => {
    const r = run('procs', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.total).toBeGreaterThan(0);
    expect(r.json.processes[0]).toHaveProperty('pid');
    expect(r.json.processes[0]).toHaveProperty('command');
  });

  it('filters by name substring', () => {
    const r = run('procs', 'definitely-no-such-process-xyz', '--json');
    expect(r.json.matched).toBe(0);
  });
});

describe('disk', () => {
  it('reports at least one real mount with totals', () => {
    const r = run('disk', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.count).toBeGreaterThanOrEqual(1);
    const m = r.json.mounts[0];
    expect(m.totalBytes).toBeGreaterThan(0);
    expect(m.usedPercent).toBeGreaterThanOrEqual(0);
    expect(m.usedPercent).toBeLessThanOrEqual(100);
  });
});

describe('dns', () => {
  it('resolves localhost via the system resolver', () => {
    const r = run('dns', 'localhost', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.resolved.address).toMatch(/^(127\.0\.0\.1|::1)$/);
  });

  it('rejects an invalid hostname with exit 2', () => {
    const r = run('dns', 'not a hostname!', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidHostname');
  });
});

describe('trash', () => {
  it('moves a file out of its original location (recoverably)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mfn-trash-'));
    const file = join(dir, 'junk.txt');
    writeFileSync(file, 'bye');
    const r = runIn(dir, 'trash', file, '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.count).toBe(1);
    expect(existsSync(file)).toBe(false);
  });

  it('refuses to trash the cwd', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mfn-trash-'));
    const r = runIn(dir, 'trash', dir, '--json');
    expect(r.code).toBe(1);
    expect(r.json.error).toBe('TrashFailed');
    expect(existsSync(dir)).toBe(true);
  });

  it('a missing path is a clean failure, not a crash', () => {
    const r = run('trash', '/definitely/not/a/real/path-xyz', '--json');
    expect(r.code).toBe(1);
    expect(r.json.ok).toBe(false);
  });
});

describe('open (validation only — never opens anything in CI)', () => {
  it('rejects a missing file with exit 2', () => {
    const r = run('open', '/definitely/not/a/real/file-xyz', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('NotFound');
  });

  it('rejects non-http schemes with exit 2', () => {
    const r = run('open', 'javascript:alert(1)', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('UnsupportedScheme');
  });
});

describe('clip / notify (headless CI: any outcome must keep the JSON contract)', () => {
  it('clip write returns a single JSON envelope whether or not a clipboard exists', () => {
    const r = run('clip', 'mfn-ci-probe', '--json');
    expect(r.singleObject).toBe(true);
    if (r.json.ok) expect(r.json.action).toBe('write');
    else expect(r.json.error).toBe('ClipboardUnavailable');
  });

  it('notify returns a single JSON envelope whether or not a desktop exists', () => {
    const r = run('notify', 'mfn ci probe', '--json');
    expect(r.singleObject).toBe(true);
    if (!r.json.ok) expect(r.json.error).toBe('NotifyFailed');
  });

  it('notify rejects an oversized message with exit 2', () => {
    const r = run('notify', 'x'.repeat(3000), '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InputTooLarge');
  });
});
