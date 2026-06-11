import type { CommandInfo } from './catalog';

/** The original toolkit: discovery, time, crypto primitives, OS/filesystem. */
export const CLASSIC_COMMANDS: readonly CommandInfo[] = [
  {
    name: 'capabilities',
    category: 'discovery',
    summary: 'Self-describing manifest of every command an agent can call',
    examples: ['mfn capabilities --json'],
  },
  {
    name: 'mcp',
    category: 'discovery',
    summary: 'Serve every command over the Model Context Protocol (stdio) for MCP clients',
    examples: ['mfn mcp', 'mfn mcp --json'],
  },
  {
    name: 'epoch',
    category: 'time',
    summary: 'Convert between epoch timestamps and dates (auto-detects unit)',
    examples: ['mfn epoch 1622547800 --json', 'mfn epoch --from 2021-06-01T11:43:20Z --json'],
  },
  {
    name: 'date',
    category: 'time',
    summary: 'Convert/format a date across timezones (defaults to now)',
    examples: ['mfn date --json', 'mfn date 2024-07-04T15:30:30Z --tz America/New_York --json'],
  },
  {
    name: 'decode',
    category: 'crypto',
    summary: 'Decode a JWT token (header + payload; signature not verified)',
    examples: ['mfn decode -t <jwt> --json'],
  },
  {
    name: 'kill',
    category: 'net',
    summary: 'Kill the process(es) listening on specific ports',
    examples: ['mfn kill -p 3000 8080 -y --json'],
  },
  {
    name: 'sc',
    category: 'code',
    summary: 'Find files/folders under the current directory (fuzzy match)',
    examples: ['mfn sc service --json'],
  },
  {
    name: 'cts',
    category: 'code',
    summary: 'Print (or export) a tree of the current working directory',
    examples: ['mfn cts --json', 'mfn cts -t png'],
  },
  {
    name: 'update',
    category: 'discovery',
    summary: 'Update the CLI or a specified package to the latest version',
    examples: ['mfn update --json', 'mfn update <package> --json'],
  },
  {
    name: 'id',
    category: 'crypto',
    summary: 'Generate identifiers (UUID v4/v7 or URL-safe nano id)',
    examples: ['mfn id --json', 'mfn id -t uuid7 -n 3 --json'],
  },
  {
    name: 'hash',
    category: 'crypto',
    summary: 'Hash a string, file, or stdin (md5/sha1/sha256/sha512)',
    examples: ['mfn hash hello --json', 'mfn hash -a md5 -f ./file.txt --json'],
  },
  {
    name: 'encode',
    category: 'crypto',
    summary: 'Encode/decode text (base64, base64url, hex, url)',
    examples: ['mfn encode hello --json', 'mfn encode aGVsbG8= -d --json'],
  },
  {
    name: 'random',
    category: 'crypto',
    summary: 'Generate secure random bytes or a password',
    examples: ['mfn random --json', 'mfn random -p -l 32 --json'],
  },
  {
    name: 'port',
    category: 'net',
    summary: 'Find a free port, or check whether a specific port is available',
    examples: ['mfn port --json', 'mfn port -c 3000 --json'],
  },
] as const;
