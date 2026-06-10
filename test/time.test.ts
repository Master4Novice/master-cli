import { describe, it, expect } from 'vitest';
import { run } from './helpers';

describe('epoch', () => {
  it('epoch → date auto-detects seconds', () => {
    const r = run('epoch', '1622547800', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.unit).toBe('seconds');
  });

  it('rejects a fractional epoch with exit 2 (bad input)', () => {
    const r = run('epoch', '1622547800.5', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
  });

  it('rejects an empty epoch value with exit 2', () => {
    const r = run('epoch', '', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('MissingInput');
  });
});

describe('date', () => {
  it('defaults to now and reports UTC + zoned + epoch', () => {
    const r = run('date', '--json');
    expect(r.json.ok).toBe(true);
    expect(typeof r.json.epochInMilliseconds).toBe('number');
    expect(r.json.utc).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('converts a date into a target timezone', () => {
    const r = run('date', '2024-07-04T15:30:30Z', '--tz', 'America/New_York', '--json');
    expect(r.json.zoned).toBe('2024-07-04 11:30:30');
    expect(r.json.timezone).toBe('America/New_York');
  });

  it('rejects an unknown timezone with exit 2', () => {
    const r = run('date', '--tz', 'Not/AZone', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
  });
});

describe('decode (JWT)', () => {
  it('decodes header + payload and reports expiry', () => {
    // {"alg":"HS256"}.{"exp":1}.x  → exp far in the past
    const r = run('decode', '-t', 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.x', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.header.alg).toBe('HS256');
    expect(r.json.expiry.expired).toBe(true);
  });

  it('rejects a malformed JWT with exit 2 (bad input)', () => {
    const r = run('decode', '-t', 'not-a-jwt', '--json');
    expect(r.code).toBe(2);
    expect(r.json.ok).toBe(false);
  });
});
