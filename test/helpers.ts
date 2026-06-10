import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BIN = fileURLToPath(new URL('../dist/bin/index.js', import.meta.url));

export interface Run {
  code: number;
  stdout: string;
  trimmed: string;
  json: any;
  parseOk: boolean;
  singleObject: boolean;
}

/** Run the built CLI as a subprocess (the real agent/shell entry point). */
export function run(...args: string[]): Run {
  return runIn(process.cwd(), ...args);
}

/** Same as run(), but from a specific working directory. */
export function runIn(cwd: string, ...args: string[]): Run {
  let stdout: string;
  let code = 0;
  try {
    stdout = execFileSync('node', [BIN, ...args], { encoding: 'utf8', cwd });
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
