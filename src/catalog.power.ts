import type { CommandInfo } from './catalog';

/**
 * Agent generation 2: the commands an AI coding agent reaches for constantly —
 * code navigation, dependency tracing, bulk edits, readiness waits, and
 * environment drift checks.
 */
export const POWER_COMMANDS: readonly CommandInfo[] = [
  {
    name: 'outline',
    category: 'code',
    summary: 'Outline a source file: functions/classes/exports with line numbers',
    examples: ['mfn outline src/app.ts --json', 'mfn outline README.md --json'],
  },
  {
    name: 'imports',
    category: 'code',
    summary: 'List a file’s imports, or find every file that imports a module',
    examples: ['mfn imports src/app.ts --json', 'mfn imports --who utility --json'],
  },
  {
    name: 'replace',
    category: 'code',
    summary: 'Literal find/replace across files — dry-run by default, JSON change report',
    examples: [
      'mfn replace "oldName" "newName" -g "src/**/*.ts" --json',
      'mfn replace "v1" "v2" -g "**/*.md" --write --json',
    ],
  },
  {
    name: 'recent',
    category: 'code',
    summary: 'Most recently modified files under a directory, with age',
    examples: ['mfn recent --json', 'mfn recent ./src -t 5 --json'],
  },
  {
    name: 'pkg',
    category: 'code',
    summary: 'Declared vs installed dependency versions — drift in one call',
    examples: ['mfn pkg --json', 'mfn pkg typescript --json'],
  },
  {
    name: 'dotenv',
    category: 'system',
    summary: 'Check .env against .env.example — missing/extra keys, values never shown',
    examples: ['mfn dotenv --json', 'mfn dotenv -f .env.local -e .env.example --json'],
  },
  {
    name: 'wait',
    category: 'net',
    summary: 'Block until a port, file, or URL is ready (with timeout) — no sleep loops',
    examples: ['mfn wait -p 3000 -t 30 --json', 'mfn wait -u http://localhost:3000/health --json'],
  },
  {
    name: 'ports',
    category: 'net',
    summary: 'List ALL listening TCP ports with their owning processes',
    examples: ['mfn ports --json'],
  },
  {
    name: 'http',
    category: 'net',
    summary: 'Probe a URL: status, headers, timing, capped body preview',
    examples: ['mfn http https://api.github.com --json', 'mfn http localhost:3000/health --json'],
  },
  {
    name: 'base',
    category: 'data',
    summary: 'Convert numbers between bases (hex/dec/bin/oct) exactly, BigInt-safe',
    examples: ['mfn base 0xff --json', 'mfn base 255 --json'],
  },
] as const;
