import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, runIn, BIN } from './helpers';
import { scanSecrets, isSensitivePath } from '../src/utility/guard';

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
});

describe('network guardrails', () => {
  it('http refuses the AWS metadata endpoint without making a request', () => {
    const r = run('http', 'http://169.254.169.254/latest/meta-data/', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('BlockedTarget');
  });

  it('http refuses metadata.google.internal', () => {
    const r = run('http', 'http://metadata.google.internal/computeMetadata/v1/', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('BlockedTarget');
  });

  it('wait -u refuses metadata endpoints', () => {
    const r = run('wait', '-u', 'http://169.254.169.254/x', '-t', '1', '--json');
    expect(r.code).toBe(2);
    expect(r.json.error).toBe('BlockedTarget');
  });
});

describe('env value-shape redaction', () => {
  it('redacts an innocently named variable holding a JWT', () => {
    const out = execFileSync('node', [BIN, 'env', 'TOTALLY_FINE_VAR', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, TOTALLY_FINE_VAR: FAKE_JWT },
    });
    const json = JSON.parse(out.trim());
    const v = json.vars[0];
    expect(v.redacted).toBe(true);
    expect(out).not.toContain(FAKE_JWT);
  });

  it('leaves a normal value un-redacted', () => {
    const out = execFileSync('node', [BIN, 'env', 'TOTALLY_FINE_VAR', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, TOTALLY_FINE_VAR: 'production' },
    });
    expect(JSON.parse(out.trim()).vars[0].value).toBe('production');
  });
});

describe('clipboard secret redaction (when a clipboard exists)', () => {
  it('a secret-shaped clipboard read comes back redacted', () => {
    const w = run('clip', FAKE_JWT, '--json');
    if (!w.json.ok) return; // headless CI — no clipboard; covered by os.test.ts
    const r = run('clip', '--read', '--json');
    expect(r.json.redacted).toBe(true);
    expect(r.stdout).not.toContain(FAKE_JWT);
    run('clip', 'mfn guardrail test done', '--json'); // leave nothing secret-shaped behind
  });
});

describe('guard unit checks', () => {
  it('scanSecrets catches the major token shapes', () => {
    expect(scanSecrets('-----BEGIN RSA PRIVATE KEY-----')).toBe('private key block');
    expect(scanSecrets(`Bearer ${FAKE_JWT}`)).toBe('JWT');
    expect(scanSecrets('AKIAIOSFODNN7EXAMPLE')).toBe('AWS access key id');
    expect(scanSecrets('ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8')).toBe('GitHub token');
    expect(scanSecrets('plain old release notes')).toBeNull();
  });

  it('isSensitivePath flags credential locations and not normal files', () => {
    expect(isSensitivePath('/home/u/.ssh/config')).toBe(true);
    expect(isSensitivePath('/home/u/.aws/credentials')).toBe(true);
    expect(isSensitivePath('certs/server.key')).toBe(true);
    expect(isSensitivePath('.env.production')).toBe(true);
    expect(isSensitivePath('src/index.ts')).toBe(false);
    expect(isSensitivePath('package.json')).toBe(false);
  });
});
