/**
 * Shared security guardrails. Three protections, applied across commands:
 *
 * 1. isSensitivePath  — files that hold credentials/keys/PII must never have
 *    their CONTENT returned to a caller (an AI agent's context window is a
 *    log that never gets rotated). Commands that return file content check
 *    this; commands that return only derived facts (counts, digests) do not.
 * 2. scanSecrets      — detects secret-shaped text (private keys, JWTs, cloud
 *    and platform tokens) so clipboard reads and env values can be redacted
 *    before they ever reach stdout.
 * 3. isBlockedUrl     — outbound probes must never reach cloud metadata
 *    endpoints (169.254.169.254 etc.) — the classic credential-theft pivot.
 *
 * There are intentionally NO bypass flags. See SECURITY.md.
 */
import path from 'node:path';
import fs from 'node:fs';

const SENSITIVE_SEGMENTS = ['.ssh', '.gnupg', '.aws', '.kube', '.docker', '.gcloud', '.azure'];

const SENSITIVE_BASENAMES = [
  '.netrc',
  '.npmrc',
  '.pgpass',
  '.git-credentials',
  'shadow',
  'credentials',
  'otr.private_key',
];

const SENSITIVE_PATTERNS = [
  /^id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /\.(pem|key|p12|pfx|keystore|jks|asc)$/i,
  /^\.env(\..+)?$/i, // .env, .env.local, … — `mfn dotenv` is the safe reader
];

/** Does this exact path string match a sensitive segment/basename/pattern? */
function matchesSensitive(p: string): boolean {
  const abs = path.resolve(p);
  const segments = abs.split(path.sep).filter(Boolean);
  const base = path.basename(abs);
  if (segments.some((s) => SENSITIVE_SEGMENTS.includes(s.toLowerCase()))) return true;
  if (SENSITIVE_BASENAMES.includes(base.toLowerCase())) return true;
  return SENSITIVE_PATTERNS.some((re) => re.test(base));
}

/**
 * True when reading this file's CONTENT would expose credentials/keys/PII.
 * Checks the literal path AND the resolved realpath, so an innocently named
 * symlink ("notes.txt" → "~/.ssh/id_rsa") can't smuggle a secret past the
 * basename check (found by an adversarial review).
 */
export function isSensitivePath(p: string): boolean {
  if (matchesSensitive(p)) return true;
  try {
    const real = fs.realpathSync(p);
    if (real !== path.resolve(p) && matchesSensitive(real)) return true;
  } catch {
    /* path doesn't exist / not resolvable — the literal check above stands */
  }
  return false;
}

/** Standard refusal message for a sensitive path (stable error: SensitivePath). */
export const sensitivePathMessage = (p: string): string =>
  `Refusing to return the contents of "${p}" — it matches a credential/secret ` +
  `location (guardrail, no override; see SECURITY.md).`;

const SECRET_PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/, 'JWT'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/, 'GitHub fine-grained token'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'API secret key (sk-…)'],
  [/\bxox[abpsr]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bnpm_[A-Za-z0-9]{36}\b/, 'npm token'],
];

/** Returns what kind of secret the text contains, or null when none detected. */
export function scanSecrets(text: string): string | null {
  for (const [re, kind] of SECRET_PATTERNS) {
    if (re.test(text)) return kind;
  }
  return null;
}

/**
 * Mask secret-shaped substrings inside text that a command echoes back. This
 * is the content-level backstop to isSensitivePath's path-level check: even
 * when a secret arrives via stdin (`cat .env | mfn freq`) — where there is no
 * path to vet — a JWT/private key/cloud token is replaced before it reaches
 * stdout. Returns the (possibly) masked text and how many tokens were masked.
 */
export function redactSecrets(text: string): { text: string; redactedCount: number } {
  let redactedCount = 0;
  let out = text;
  for (const [re, kind] of SECRET_PATTERNS) {
    out = out.replace(new RegExp(re, 'g'), () => {
      redactedCount++;
      return `[redacted: ${kind}]`;
    });
  }
  return { text: out, redactedCount };
}

/**
 * True for URLs that must never be probed: cloud metadata services. Local
 * dev servers (localhost/127.0.0.1) stay allowed — probing them is the point.
 */
export function isBlockedUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'metadata.google.internal' || host === 'metadata') return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true; // link-local incl. 169.254.169.254
  if (host === 'fd00:ec2::254' || host === '100.100.100.200') return true; // AWS IMDSv6, Alibaba
  return false;
}

export const blockedUrlMessage = (url: string): string =>
  `Refusing to request "${url}" — cloud metadata endpoints are blocked ` +
  `(credential-theft guardrail, no override; see SECURITY.md).`;
