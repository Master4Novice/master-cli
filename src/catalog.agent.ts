import type { CommandInfo } from './catalog';

/** Agent generation 1: token savers and deterministic ground-truth commands. */
export const AGENT_COMMANDS: readonly CommandInfo[] = [
  {
    name: 'json',
    category: 'data',
    summary: 'Extract one value/keys/length from JSON without reading the whole document',
    examples: [
      'mfn json scripts.build -f package.json --json',
      'cat d.json | mfn json users[0].name --json',
    ],
  },
  {
    name: 'schema',
    category: 'data',
    summary: 'Infer the shape of a JSON document (paths + types) without dumping the data',
    examples: ['mfn schema -f response.json --json', 'curl -s api/u | mfn schema --json'],
  },
  {
    name: 'count',
    category: 'text',
    summary: 'Lines/words/chars/bytes + LLM token estimate of a file, stdin, or text',
    examples: ['mfn count -f big.log --json', 'git diff | mfn count --json'],
  },
  {
    name: 'lines',
    category: 'text',
    summary: 'Read an exact line range of a file (1-based) instead of the whole file',
    examples: ['mfn lines src/app.ts -s 120 -n 30 --json'],
  },
  {
    name: 'diff',
    category: 'text',
    summary: 'Line diff of two files as structured hunks (counts first, content optional)',
    examples: ['mfn diff old.json new.json --json', 'mfn diff a.txt b.txt -s --json'],
  },
  {
    name: 'freq',
    category: 'text',
    summary: 'Most frequent lines of a file/stdin (log analysis in one call)',
    examples: ['mfn freq error.log -t 5 --json'],
  },
  {
    name: 'case',
    category: 'text',
    summary: 'Convert strings between naming styles (camel, snake, kebab, pascal, …)',
    examples: ['mfn case getUserName -t snake --json', 'mfn case my-component --json'],
  },
  {
    name: 'escape',
    category: 'text',
    summary: 'Escape text exactly for shell, JSON, regex, HTML, or URL contexts',
    examples: ['mfn escape "it\'s done" --json', 'mfn escape 1.2.3 -a regex --json'],
  },
  {
    name: 'calc',
    category: 'data',
    summary: 'Exact arithmetic — integer math in BigInt, no float drift, no guessing',
    examples: ['mfn calc "2^53 + 1" --json', 'mfn calc "(3 + 4) * 5" --json'],
  },
  {
    name: 'semver',
    category: 'data',
    summary: 'Validate, compare, sort, or bump semantic versions per semver.org',
    examples: ['mfn semver 1.10.0 1.9.2 --json', 'mfn semver 1.2.3 -b minor --json'],
  },
  {
    name: 'cron',
    category: 'time',
    summary: 'Validate a cron expression, explain it, and compute the next run times',
    examples: ['mfn cron "*/15 9-17 * * 1-5" --json', 'mfn cron "@daily" -n 1 --json'],
  },
  {
    name: 'regex',
    category: 'text',
    summary: 'Test a regular expression against text — verify instead of guessing',
    examples: ['mfn regex "TODO[:!]?" -f src/app.ts --json'],
  },
  {
    name: 'url',
    category: 'data',
    summary: 'Parse a URL into components with decoded query parameters',
    examples: ['mfn url "https://api.x.com/v2/users?id=42" --json'],
  },
  {
    name: 'have',
    category: 'system',
    summary: 'Check which tools are installed (path + version) in one call',
    examples: ['mfn have node git docker --json'],
  },
  {
    name: 'sys',
    category: 'system',
    summary: 'One-shot system facts: OS, node, CPU, memory, shell, timezone, paths',
    examples: ['mfn sys --json'],
  },
  {
    name: 'repo',
    category: 'code',
    summary: 'One-shot git summary: branch, dirty counts, ahead/behind, last commits',
    examples: ['mfn repo --json', 'mfn repo -n 10 --json'],
  },
  {
    name: 'env',
    category: 'system',
    summary: 'Inspect environment variables with automatic secret redaction',
    examples: ['mfn env NODE_ENV PATH --json', 'mfn env -p NEXT_PUBLIC_ --json'],
  },
  {
    name: 'size',
    category: 'code',
    summary: 'Total size + largest files/dirs under a directory in one call',
    examples: ['mfn size --json', 'mfn size ./src -t 5 --json'],
  },
  {
    name: 'ext',
    category: 'code',
    summary: 'File counts and bytes per extension — project composition at a glance',
    examples: ['mfn ext --json'],
  },
  {
    name: 'ip',
    category: 'net',
    summary: 'Local network interfaces and addresses (no ifconfig parsing)',
    examples: ['mfn ip --json'],
  },
] as const;
