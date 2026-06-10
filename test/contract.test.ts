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

describe('blind-review fixes', () => {
  it('a typoed command gets "Unknown command" + a did-you-mean suggestion', () => {
    const r = run('semvr', '--json');
    expect(r.code).toBe(2);
    expect(r.json.message).toContain('Unknown command: semvr');
    expect(r.json.message).toContain('Did you mean "semver"?');
  });

  it('count with a positional file path counts the FILE, not the path string', () => {
    const r = run('count', 'package.json', '--json');
    expect(r.json.source).toBe('file:package.json');
    expect(r.json.lines).toBeGreaterThan(10);
  });

  it('epoch output includes an ISO-8601 UTC field', () => {
    const r = run('epoch', '1622547800', '--json');
    expect(r.json.iso).toBe('2021-06-01T11:43:20.000Z');
  });

  it('date output includes an ISO-8601 UTC field', () => {
    const r = run('date', '2024-07-04T15:30:30Z', '--json');
    expect(r.json.iso).toBe('2024-07-04T15:30:30.000Z');
  });
});
