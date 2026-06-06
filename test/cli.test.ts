import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const BIN = fileURLToPath(new URL('../dist/bin/index.js', import.meta.url));

interface Run {
  code: number;
  stdout: string;
  trimmed: string;
  json: any;
  parseOk: boolean;
  singleObject: boolean;
}

/** Run the built CLI as a subprocess (the real agent/shell entry point). */
function run(...args: string[]): Run {
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync('node', [BIN, ...args], { encoding: 'utf8' });
  } catch (e: any) {
    stdout = (e.stdout ?? '').toString();
    code = typeof e.status === 'number' ? e.status : 1;
  }
  const trimmed = stdout.trim();
  let json: any;
  let parseOk = false;
  try {
    json = JSON.parse(trimmed);
    parseOk = true;
  } catch {
    /* parseOk stays false */
  }
  // The contract: exactly one JSON object on stdout.
  const singleObject = parseOk && !trimmed.includes('\n');
  return { code, stdout, trimmed, json, parseOk, singleObject };
}

describe('contract: stdout is one JSON object, with stable exit codes', () => {
  it('capabilities lists every command and self-describes', () => {
    const r = run('capabilities', '--json');
    expect(r.code).toBe(0);
    expect(r.singleObject).toBe(true);
    expect(r.json.ok).toBe(true);
    expect(r.json.commands.length).toBeGreaterThanOrEqual(13);
    expect(r.json.commands.map((c: any) => c.name)).toContain('capabilities');
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
});

describe('hash', () => {
  const SHA256_HELLO =
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

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
});

describe('port', () => {
  it('returns a numeric free port', () => {
    const r = run('port', '--json');
    expect(r.json.ok).toBe(true);
    expect(typeof r.json.port).toBe('number');
    expect(r.json.port).toBeGreaterThan(0);
  });

  it('-c reports an IPv4-only-occupied port as unavailable (dual-stack probe)', async () => {
    const PORT = 59555;
    const srv = createServer();
    await new Promise<void>((res, rej) => {
      srv.once('error', rej);
      srv.listen(PORT, '127.0.0.1', res);
    });
    try {
      const r = run('port', '-c', String(PORT), '--json');
      expect(r.json.ok).toBe(true);
      expect(r.json.available).toBe(false);
    } finally {
      await new Promise<void>((res) => srv.close(() => res()));
    }
  });

  it('-c reports a free port as available', () => {
    const free = run('port', '--json').json.port;
    const r = run('port', '-c', String(free), '--json');
    expect(r.json.available).toBe(true);
  });
});

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

describe('decode', () => {
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

describe('sc', () => {
  it('rejects a negative --limit with exit 2', () => {
    const r = run('sc', 'x', '--limit', '-1', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidLimit');
  });
});

describe('boundary validation (huge inputs must not crash — JSON envelope, exit 2)', () => {
  it('random --bytes over the cap → InvalidBytes, valid JSON, no stack trace', () => {
    const r = run('random', '-b', '2147483648', '--json');
    expect(r.code).toBe(2);
    expect(r.singleObject).toBe(true);
    expect(r.json.error).toBe('InvalidBytes');
  });

  it('random --password --length over the cap → InvalidLength', () => {
    const r = run('random', '-p', '-l', '1000000000', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidLength');
  });

  it('id --count over the cap → InvalidCount, valid JSON, no stack trace', () => {
    const r = run('id', '-n', '4294967296', '--json');
    expect(r.code).toBe(2);
    expect(r.singleObject).toBe(true);
    expect(r.json.error).toBe('InvalidCount');
  });

  it('id nano --size over the cap → InvalidSize', () => {
    const r = run('id', '-t', 'nano', '--size', '1000000000', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('InvalidSize');
  });
});

describe('encode decode rejects garbage instead of returning ""', () => {
  it('invalid hex → CodecError, exit 1', () => {
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

describe('port shape is stable across counts', () => {
  it('single and multi both expose count + ports', () => {
    const one = run('port', '--json');
    expect(one.json.count).toBe(1);
    expect(Array.isArray(one.json.ports)).toBe(true);
    expect(one.json.port).toBe(one.json.ports[0]);
  });
});
