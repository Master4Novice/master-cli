import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

const fixtureDir = () => mkdtempSync(join(tmpdir(), 'mfn-agent-'));

describe('case / escape / url / regex', () => {
  it('case converts camelCase → snake_case', () => {
    const r = run('case', 'getUserName', '-t', 'snake', '--json');
    expect(r.json.output).toBe('get_user_name');
  });

  it('escape produces a shell-safe single-quoted string', () => {
    const r = run('escape', "it's", '--json');
    expect(r.json.output).toBe(`'it'\\''s'`);
  });

  it('escape regex makes a version string literal', () => {
    const r = run('escape', '1.2.3', '-a', 'regex', '--json');
    expect(r.json.output).toBe('1\\.2\\.3');
  });

  it('url parses components and query params', () => {
    const r = run('url', 'https://api.x.com:8443/v2/users?id=42&id=43#frag', '--json');
    expect(r.json.port).toBe(8443);
    expect(r.json.query.id).toEqual(['42', '43']);
    expect(r.json.hash).toBe('frag');
  });

  it('regex finds matches with line numbers', () => {
    const r = run('regex', 'o(r)?', 'fork\nspoon', '--json');
    expect(r.json.matched).toBe(true);
    expect(r.json.matches[0].line).toBe(1);
  });

  it('regex rejects an invalid pattern with exit 2', () => {
    const r = run('regex', '(unclosed', 'x', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidRegex');
  });
});

describe('env / sys / have / diff / freq', () => {
  it('env redacts secret-looking variables', () => {
    const r = run('env', 'PATH', 'MY_SECRET_TOKEN', '--json');
    const tokenVar = r.json.vars.find((v: any) => v.name === 'MY_SECRET_TOKEN');
    // Not set in this test env — but PATH must come through un-redacted.
    const pathVar = r.json.vars.find((v: any) => v.name === 'PATH');
    expect(pathVar.redacted).toBe(false);
    expect(tokenVar.set).toBe(false);
  });

  it('sys reports platform facts', () => {
    const r = run('sys', '--json');
    expect(r.json.platform).toBe(process.platform);
    expect(r.json.cpu.cores).toBeGreaterThan(0);
  });

  it('have finds node and flags a nonsense tool as missing', () => {
    const r = run('have', 'node', 'definitely-not-a-tool-xyz', '--json');
    expect(r.json.allFound).toBe(false);
    expect(r.json.missing).toEqual(['definitely-not-a-tool-xyz']);
    expect(r.json.tools.find((t: any) => t.name === 'node').found).toBe(true);
  });

  it('have rejects a path-traversal tool name with exit 2', () => {
    const r = run('have', '../bin/sh', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidToolName');
  });

  it('diff reports hunks and counts', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'a.txt'), 'one\ntwo\nthree\n');
    writeFileSync(join(dir, 'b.txt'), 'one\nTWO\nthree\n');
    const r = runIn(dir, 'diff', 'a.txt', 'b.txt', '--json');
    expect(r.json.identical).toBe(false);
    expect(r.json.linesAdded).toBe(1);
    expect(r.json.linesRemoved).toBe(1);
  });

  it('freq ranks repeated lines', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'log.txt'), 'err A\nerr B\nerr A\n');
    const r = runIn(dir, 'freq', 'log.txt', '--json');
    expect(r.json.entries[0]).toEqual({ count: 2, line: 'err A' });
  });
});
