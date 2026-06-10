import type { CommandInfo } from './catalog';

/**
 * Agent generation 3: OS-level commands — the things an agent normally needs
 * platform-specific incantations (or a human's hands) for, made one-call and
 * safe-by-default on macOS, Windows, and Linux.
 */
export const OS_COMMANDS: readonly CommandInfo[] = [
  {
    name: 'clip',
    category: 'system',
    summary: 'Read or write the system clipboard (pbcopy/xclip/clip.exe handled for you)',
    examples: ['mfn clip --json', 'git diff | mfn clip --json'],
  },
  {
    name: 'notify',
    category: 'system',
    summary: 'Desktop notification — tell the user a long task finished, hands-free',
    examples: ['mfn notify "build finished" --json'],
  },
  {
    name: 'open',
    category: 'system',
    summary: 'Open a file or URL in the default app/browser (target validated first)',
    examples: ['mfn open coverage/index.html --json'],
  },
  {
    name: 'procs',
    category: 'system',
    summary: 'Search running processes by name: pid/cpu/mem in one call',
    examples: ['mfn procs node --json', 'mfn procs -t 10 --json'],
  },
  {
    name: 'disk',
    category: 'system',
    summary: 'Disk usage per mount (total/free/used%) without df parsing',
    examples: ['mfn disk --json'],
  },
  {
    name: 'trash',
    category: 'system',
    summary: 'Move files/dirs to the OS trash — reversible delete, never rm -rf',
    examples: ['mfn trash old-build.log --json', 'mfn trash dist coverage --json'],
  },
  {
    name: 'dns',
    category: 'net',
    summary: 'Resolve a hostname: A/AAAA/CNAME/MX/TXT/NS in one call',
    examples: ['mfn dns github.com --json', 'mfn dns example.com -t mx --json'],
  },
] as const;
