import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn } from './helpers';

const fixtureDir = () => mkdtempSync(join(tmpdir(), 'mfn-agent-'));

describe('json', () => {
  it('extracts a nested value by dot/bracket path', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'd.json'), JSON.stringify({ users: [{ name: 'asha' }] }));
    const r = runIn(dir, 'json', 'users[0].name', '-f', 'd.json', '--json');
    expect(r.json.value).toBe('asha');
    expect(r.json.type).toBe('string');
  });

  it('missing path → PathNotFound, exit 1', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'd.json'), '{"a":1}');
    const r = runIn(dir, 'json', 'b.c', '-f', 'd.json', '--json');
    expect(r.code).toBe(1);
    expect(r.json.error).toBe('PathNotFound');
  });

  it('--keys lists object keys', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'd.json'), '{"x":1,"y":2}');
    const r = runIn(dir, 'json', '-f', 'd.json', '--keys', '--json');
    expect(r.json.keys).toEqual(['x', 'y']);
  });
});

describe('schema', () => {
  it('infers paths and types without dumping values', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'd.json'), JSON.stringify({ users: [{ id: 1, tags: ['a'] }] }));
    const r = runIn(dir, 'schema', '-f', 'd.json', '--json');
    const byPath = Object.fromEntries(r.json.paths.map((p: any) => [p.path, p.type]));
    expect(byPath['users[].id']).toBe('number');
    expect(byPath['users']).toBe('array(1)');
    expect(JSON.stringify(r.json)).not.toContain('"asha"');
  });
});

describe('count / lines', () => {
  it('count reports lines, words, and a token estimate', () => {
    const r = run('count', 'one two three', '--json');
    expect(r.json.words).toBe(3);
    expect(r.json.lines).toBe(1);
    expect(r.json.tokensEstimate).toBeGreaterThan(0);
  });

  it('lines returns the exact requested range', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'f.txt'), 'l1\nl2\nl3\nl4\nl5\n');
    const r = runIn(dir, 'lines', 'f.txt', '-s', '2', '-n', '2', '--json');
    expect(r.json.content).toBe('l2\nl3');
    expect(r.json.totalLines).toBe(5);
  });

  it('lines rejects a start beyond EOF with exit 2', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'f.txt'), 'only\n');
    const r = runIn(dir, 'lines', 'f.txt', '-s', '10', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('OutOfRange');
  });
});

describe('calc', () => {
  it('integer math is exact beyond 2^53 (BigInt)', () => {
    const r = run('calc', '2^53 + 1', '--json');
    expect(r.json.result).toBe('9007199254740993');
    expect(r.json.exact).toBe(true);
  });

  it('division by zero → ParseError, exit 2', () => {
    const r = run('calc', '1/0', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
  });
});

describe('semver', () => {
  it('1.10.0 > 1.9.2 (numeric, not string, comparison)', () => {
    const r = run('semver', '1.10.0', '1.9.2', '--json');
    expect(r.json.greater).toBe('1.10.0');
  });

  it('release > prerelease of the same version', () => {
    const r = run('semver', '2.0.0-rc.1', '2.0.0', '--json');
    expect(r.json.greater).toBe('2.0.0');
  });

  it('bumps minor', () => {
    const r = run('semver', '1.2.3', '-b', 'minor', '--json');
    expect(r.json.result).toBe('1.3.0');
  });

  it('rejects garbage with exit 2', () => {
    const r = run('semver', 'not-a-version', '--json');
    expect(r.code).toBe(2);
  });
});

describe('cron', () => {
  it('validates, describes, and computes future runs', () => {
    const r = run('cron', '*/15 * * * *', '-n', '2', '--json');
    expect(r.json.valid).toBe(true);
    expect(r.json.next).toHaveLength(2);
    expect(new Date(r.json.next[0].iso).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(r.json.next[0].iso).getMinutes() % 15).toBe(0);
  });

  it('rejects a 6-field expression with exit 2', () => {
    const r = run('cron', '* * * * * *', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidCron');
  });
});
