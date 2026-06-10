import { describe, it, expect } from 'vitest';
import { run } from './helpers';

/**
 * Black-box conformance sweep: the command list comes from the BINARY's own
 * manifest (not the source), and every command is invoked the way a naive
 * agent would. Whatever happens — success, missing input, no clipboard —
 * the contract must hold: ONE parseable JSON object on stdout, exit 0/1/2.
 *
 * `update` is excluded from the bare run (it would npm-install globally);
 * its --help is still verified.
 */
const manifest = run('capabilities', '--json');
const allCommands: string[] = manifest.json.commands.map((c: any) => c.name);
const bareRunnable = allCommands.filter((name) => name !== 'update');

describe('black-box sweep across the full manifest', () => {
  it('manifest is complete and well-formed', () => {
    expect(manifest.json.ok).toBe(true);
    expect(allCommands.length).toBeGreaterThanOrEqual(50);
    for (const c of manifest.json.commands) {
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.category).toBeTruthy();
      expect(c.examples.length).toBeGreaterThan(0);
    }
  });

  it(
    'every command, invoked bare with --json, returns one JSON envelope and exit 0/1/2',
    { timeout: 240_000 },
    () => {
      const violations: string[] = [];
      for (const name of bareRunnable) {
        const r = run(name, '--json');
        if (!r.parseOk) {
          violations.push(`${name}: stdout is not JSON: ${r.trimmed.slice(0, 80)}`);
          continue;
        }
        if (!r.singleObject) violations.push(`${name}: more than one object on stdout`);
        if (![0, 1, 2].includes(r.code)) violations.push(`${name}: exit code ${r.code}`);
        if (r.json.ok === false && typeof r.json.error !== 'string') {
          violations.push(`${name}: failure without a stable error code`);
        }
        if (r.json.ok === false && r.code === 0) {
          violations.push(`${name}: ok:false but exit 0`);
        }
        if (r.json.ok === true && r.code !== 0) {
          violations.push(`${name}: ok:true but exit ${r.code}`);
        }
      }
      expect(violations, violations.join('\n')).toEqual([]);
    },
  );

  it('every command answers --help with exit 0 and usage text', { timeout: 240_000 }, () => {
    const violations: string[] = [];
    for (const name of allCommands) {
      const r = run(name, '--help');
      if (r.code !== 0) violations.push(`${name} --help: exit ${r.code}`);
      if (!r.stdout.includes(name)) violations.push(`${name} --help: no usage text`);
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it(
    'garbage flags on every command fail loudly (exit 2, JSON), never silently succeed',
    { timeout: 240_000 },
    () => {
      const violations: string[] = [];
      for (const name of bareRunnable) {
        const r = run(name, '--definitely-not-a-flag', '--json');
        if (r.code !== 2) violations.push(`${name}: unknown flag exited ${r.code}, want 2`);
        if (!r.parseOk || r.json.ok !== false) violations.push(`${name}: no failure envelope`);
      }
      expect(violations, violations.join('\n')).toEqual([]);
    },
  );
});
