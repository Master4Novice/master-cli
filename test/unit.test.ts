import { describe, it, expect } from 'vitest';
import { COMMANDS } from '../src/catalog';

describe('command catalog (drives `capabilities` + the banner)', () => {
  it('every command has a name, summary, and at least one mfn example', () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(13);
    for (const c of COMMANDS) {
      expect(c.name).toMatch(/^[a-z]+$/);
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.examples.length).toBeGreaterThan(0);
      for (const ex of c.examples) expect(ex).toContain('mfn ');
    }
  });

  it('command names are unique', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes capabilities itself', () => {
    expect(COMMANDS.map((c) => c.name)).toContain('capabilities');
  });
});
