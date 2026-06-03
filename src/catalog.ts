/**
 * Single source of truth for the command catalogue — consumed by the welcome
 * banner (the "tools" line) and by `mfn capabilities` (the agent-facing
 * manifest). Keep this in sync when adding a command.
 */
export interface CommandInfo {
  /** Invocation name, e.g. `epoch`. */
  name: string;
  /** One-line human summary. */
  summary: string;
  /** Copy-paste examples (headless, agent-friendly). */
  examples: string[];
}

export const COMMANDS: readonly CommandInfo[] = [
  {
    name: 'capabilities',
    summary: 'Self-describing manifest of every command an agent can call',
    examples: ['mfn capabilities --json'],
  },
  {
    name: 'epoch',
    summary: 'Convert between epoch timestamps and dates (auto-detects unit)',
    examples: ['mfn epoch 1622547800 --json', 'mfn epoch --from 2021-06-01T11:43:20Z --json'],
  },
  {
    name: 'date',
    summary: 'Convert/format a date across timezones (defaults to now)',
    examples: ['mfn date --json', 'mfn date 2024-07-04T15:30:30Z --tz America/New_York --json'],
  },
  {
    name: 'decode',
    summary: 'Decode a JWT token (header + payload; signature not verified)',
    examples: ['mfn decode -t <jwt> --json'],
  },
  {
    name: 'kill',
    summary: 'Kill the process(es) listening on specific ports',
    examples: ['mfn kill -p 3000 8080 -y --json'],
  },
  {
    name: 'sc',
    summary: 'Find files/folders under the current directory (fuzzy match)',
    examples: ['mfn sc service --json'],
  },
  {
    name: 'cts',
    summary: 'Print (or export) a tree of the current working directory',
    examples: ['mfn cts --json', 'mfn cts -t png'],
  },
  {
    name: 'update',
    summary: 'Update the CLI or a specified package to the latest version',
    examples: ['mfn update --json', 'mfn update <package> --json'],
  },
] as const;
