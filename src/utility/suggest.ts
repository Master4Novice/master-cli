import { COMMANDS } from '../catalog';

/** Levenshtein distance, early-exit when rows exceed the cap. */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Rewrite yargs' "Unknown argument: X" into an agent-actionable message when X
 * is the attempted command: name the problem correctly, suggest the nearest
 * real command, and point at `mfn capabilities`.
 */
export function improveUnknownCommandMessage(msg: string): string {
  const m = /^Unknown arguments?: (.+)$/.exec(msg);
  if (!m) return msg;
  // yargs lists unknown flags AND the unknown command together ("json, semvr"
  // for `mfn semvr --json`). The attempted command is the first POSITIONAL
  // token on the real argv — flags arrive as "--name", so a bare match
  // distinguishes `semvr` (command) from `json` (the --json flag).
  const items = m[1].split(',').map((s) => s.trim());
  const positional = process.argv.slice(2).find((t) => !t.startsWith('-'));
  const attempted = items.find((t) => t === positional);
  // Unknown flags on a real command (or no positional at all) — leave as-is.
  if (!attempted) return msg;

  let best: string | null = null;
  let bestDist = 3; // suggest only close typos
  for (const c of COMMANDS) {
    const d = distance(attempted, c.name, bestDist);
    if (d < bestDist) {
      bestDist = d;
      best = c.name;
    }
  }
  const hint = best ? ` Did you mean "${best}"?` : '';
  return `Unknown command: ${attempted}.${hint} Run \`mfn capabilities\` to list commands.`;
}
