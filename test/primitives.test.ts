import { describe, it, expect } from 'vitest';
import { run } from './helpers';

describe('id', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  // v7: version nibble 7, variant nibble in [89ab] (RFC 9562).
  const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('uuid v4 by default', () => {
    const r = run('id', '--json');
    expect(r.json.ok).toBe(true);
    expect(r.json.ids[0]).toMatch(UUID);
  });

  it('uuid v7 has correct version/variant nibbles and embeds the current time', () => {
    const r = run('id', '-t', 'uuid7', '-n', '5', '--json');
    expect(r.json.ids).toHaveLength(5);
    for (const id of r.json.ids) expect(id).toMatch(UUID7);
    // The first 48 bits are a big-endian Unix-ms timestamp (RFC 9562). v7 is
    // time-ordered ACROSS milliseconds (not within one ms), so assert the
    // embedded timestamp is "now" rather than intra-batch sort order.
    const tsMs = parseInt(r.json.ids[0].replace(/-/g, '').slice(0, 12), 16);
    expect(Math.abs(Date.now() - tsMs)).toBeLessThan(5000);
  });

  it('nano respects --size and uses only url-safe chars', () => {
    const r = run('id', '-t', 'nano', '--size', '16', '--json');
    expect(r.json.ids[0]).toHaveLength(16);
    expect(r.json.ids[0]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects --count 0 with exit 2', () => {
    const r = run('id', '-n', '0', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidCount');
  });

  it('rejects --count over the cap (no stack trace, valid JSON)', () => {
    const r = run('id', '-n', '4294967296', '--json');
    expect(r.code).toBe(2);
    expect(r.singleObject).toBe(true);
    expect(r.json.error).toBe('InvalidCount');
  });

  it('rejects nano --size over the cap', () => {
    const r = run('id', '-t', 'nano', '--size', '1000000000', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidSize');
  });
});

describe('hash', () => {
  const SHA256_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

  it('sha256 of a string matches the known digest', () => {
    const r = run('hash', 'hello', '--json');
    expect(r.json.hash).toBe(SHA256_HELLO);
    expect(r.json.algo).toBe('sha256');
  });

  it('md5 + base64 encoding works', () => {
    const r = run('hash', 'hello', '-a', 'md5', '-e', 'base64', '--json');
    expect(r.json.algo).toBe('md5');
    expect(r.json.encoding).toBe('base64');
  });
});

describe('encode', () => {
  it('round-trips base64', () => {
    const enc = run('encode', 'hello world', '--json');
    expect(enc.json.output).toBe('aGVsbG8gd29ybGQ=');
    const dec = run('encode', enc.json.output, '-d', '--json');
    expect(dec.json.output).toBe('hello world');
  });

  it('url-encodes', () => {
    const r = run('encode', 'a b&c', '--as', 'url', '--json');
    expect(r.json.output).toBe('a%20b%26c');
  });

  it('invalid hex decode → CodecError, exit 1 (not "")', () => {
    const r = run('encode', 'zzz', '--as', 'hex', '-d', '--json');
    expect(r.code).toBe(1);
    expect(r.json.ok).toBe(false);
    expect(r.json.error).toBe('CodecError');
  });

  it('valid hex still decodes', () => {
    const r = run('encode', '68656c6c6f', '--as', 'hex', '-d', '--json');
    expect(r.json.output).toBe('hello');
  });
});

describe('random', () => {
  it('emits N bytes in the requested encoding', () => {
    const r = run('random', '-b', '8', '-e', 'hex', '--json');
    expect(r.json.value).toMatch(/^[0-9a-f]{16}$/); // 8 bytes = 16 hex chars
  });

  it('password respects --length', () => {
    const r = run('random', '-p', '-l', '24', '--json');
    expect(r.json.kind).toBe('password');
    expect(r.json.value).toHaveLength(24);
  });

  it('rejects --bytes over the cap (no stack trace, valid JSON)', () => {
    const r = run('random', '-b', '2147483648', '--json');
    expect(r.code).toBe(2);
    expect(r.singleObject).toBe(true);
    expect(r.json.error).toBe('InvalidBytes');
  });

  it('rejects --password --length over the cap', () => {
    const r = run('random', '-p', '-l', '1000000000', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidLength');
  });
});
