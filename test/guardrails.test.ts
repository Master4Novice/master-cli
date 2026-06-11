import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIn, BIN } from './helpers';

/**
 * Create a symlink, returning false if the OS refuses (Windows CI runners lack
 * the privilege). Cross-platform — no shelling out to `ln`, which doesn't exist
 * on Windows.
 */
function trySymlink(target: string, linkPath: string): boolean {
  try {
    symlinkSync(target, linkPath);
    return true;
  } catch {
    return false;
  }
}

const fixtureDir = () => mkdtempSync(join(tmpdir(), 'mfn-guard-'));
// A secret-shaped (but fake) JWT for redaction tests.
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9x.eyJzdWIiOiIxMjM0NTY3ODkwIn0y.c2lnbmF0dXJlLXBhcnQtaGVyZQ';

describe('sensitive-path refusal (content never reaches an agent)', () => {
  it('lines refuses an id_rsa file', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'id_rsa'), 'FAKE PRIVATE KEY MATERIAL');
    const r = runIn(dir, 'lines', 'id_rsa', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('SensitivePath');
    expect(r.stdout).not.toContain('FAKE PRIVATE KEY MATERIAL');
  });

  it('json refuses a .env file', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, '.env'), 'TOP_SECRET=hunter2');
    const r = runIn(dir, 'json', '-f', '.env', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('SensitivePath');
    expect(r.stdout).not.toContain('hunter2');
  });

  it('diff refuses when either side is sensitive', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'ok.txt'), 'hello');
    writeFileSync(join(dir, 'server.pem'), 'CERT');
    const r = runIn(dir, 'diff', 'ok.txt', 'server.pem', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('SensitivePath');
  });

  it('freq and regex -f refuse credential paths', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, '.npmrc'), '//registry:_authToken=secret');
    expect(runIn(dir, 'freq', '.npmrc', '--json').json.error).toBe('SensitivePath');
    expect(runIn(dir, 'regex', 'x', '-f', '.npmrc', '--json').json.error).toBe('SensitivePath');
  });

  it('hash -f refuses a credentials file (digest is offline-brute-forceable)', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'credentials'), 'aws_secret_access_key = hunter2');
    const r = runIn(dir, 'hash', '-f', 'credentials', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('SensitivePath');
    expect(r.json.hash).toBeUndefined();
  });

  it('hash -f refuses a sensitive file behind an innocently named symlink', (ctx) => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'id_rsa'), 'FAKE KEY');
    if (!trySymlink(join(dir, 'id_rsa'), join(dir, 'notes.txt'))) {
      ctx.skip();
      return;
    }
    expect(runIn(dir, 'hash', '-f', 'notes.txt', '--json').json.error).toBe('SensitivePath');
  });

  it('hash still works on ordinary files, text, and stdin', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'plain.txt'), 'hello');
    const file = runIn(dir, 'hash', '-f', 'plain.txt', '--json');
    expect(file.code).toBe(0);
    expect(file.json.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(runIn(dir, 'hash', 'hello', '--json').json.hash).toBe(file.json.hash);
  });
});

describe('sensitive-path bypass closures (from adversarial review)', () => {
  it('a symlink with an innocent name to a sensitive file is still refused', (ctx) => {
    const dir = fixtureDir();
    writeFileSync(join(dir, '.env'), 'FAKE_SECRET=leakme123');
    // notes.txt → .env ; the basename is innocent, the realpath is not.
    if (!trySymlink(join(dir, '.env'), join(dir, 'notes.txt'))) {
      ctx.skip(); // OS won't let us create a symlink (e.g. unprivileged Windows)
      return;
    }
    const r = runIn(dir, 'lines', 'notes.txt', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('SensitivePath');
    expect(r.stdout).not.toContain('leakme123');
  });

  it('secret-shaped content piped via stdin is masked, not echoed', () => {
    // `cat .env | mfn freq` — no path to vet, so the content backstop applies.
    const out = execFileSync('node', [BIN, 'freq', '--json'], {
      encoding: 'utf8',
      input: `API_TOKEN=${FAKE_JWT}\nAPI_TOKEN=${FAKE_JWT}\nnormal line\n`,
    });
    expect(out).not.toContain(FAKE_JWT);
    expect(out).toContain('[redacted: JWT]');
  });

  it('a private key BODY piped line-by-line is masked, not just the BEGIN marker', () => {
    const body = 'MIIEowIBAAKCAQEA' + 'a'.repeat(60); // pure base64-ish key line
    const pem = `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----\n`;
    const out = execFileSync('node', [BIN, 'freq', '--json'], { encoding: 'utf8', input: pem });
    expect(out).not.toContain(body);
    expect(out).toContain('[redacted');
  });

  it('does not over-redact ordinary code/prose lines', () => {
    const code = 'const userName = getActiveUserFromSession(req);\nreturn userName.trim();\n';
    const out = execFileSync('node', [BIN, 'freq', '--json'], { encoding: 'utf8', input: code });
    expect(out).not.toContain('redacted');
  });

  it('json value that is a secret comes back masked', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'cfg.json'), JSON.stringify({ token: FAKE_JWT, name: 'ok' }));
    const r = runIn(dir, 'json', 'token', '-f', 'cfg.json', '--json');
    expect(r.stdout).not.toContain(FAKE_JWT);
    expect(r.json.value).toContain('[redacted');
  });

  it('lines masks a secret embedded in an otherwise-normal file', () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, 'config.ts'), `const KEY = "${FAKE_JWT}";\nexport default KEY;\n`);
    const r = runIn(dir, 'lines', 'config.ts', '--json');
    expect(r.stdout).not.toContain(FAKE_JWT);
    expect(r.json.content).toContain('[redacted');
  });
});
