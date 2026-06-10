import { describe, it, expect } from 'vitest';
import { run } from './helpers';

describe('contract: stdout is one JSON object, with stable exit codes', () => {
  it('capabilities lists every command and self-describes', () => {
    const r = run('capabilities', '--json');
    expect(r.code).toBe(0);
    expect(r.singleObject).toBe(true);
    expect(r.json.ok).toBe(true);
    expect(r.json.commands.length).toBeGreaterThanOrEqual(13);
    expect(r.json.commands.map((c: any) => c.name)).toContain('capabilities');
  });

  it('capabilities points agents at the docs (readme + llms.txt)', () => {
    const r = run('capabilities', '--json');
    expect(r.json.docs.readme).toContain('github.com');
    expect(r.json.docs.llmsTxt).toContain('llms.txt');
  });

  it('unknown command → UsageError, exit 2, JSON envelope', () => {
    const r = run('definitelynotacommand', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
    expect(r.json.error).toBe('UsageError');
  });

  it('unknown flag → UsageError, exit 2', () => {
    const r = run('id', '--nope', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
  });
});
