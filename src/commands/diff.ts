import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail } from '../utility/io';
import { isSensitivePath, sensitivePathMessage } from '../utility/guard';

interface Hunk {
  aStart: number;
  aLines: number;
  bStart: number;
  bLines: number;
  removed: string[];
  added: string[];
}

/**
 * Myers-lite line diff: LCS via dynamic programming, then walk back to build
 * hunks. Bounded input keeps the O(n·m) table sane for CLI-scale files.
 */
function diffLines(a: string[], b: string[]): Hunk[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    const hunk: Hunk = {
      aStart: i + 1,
      aLines: 0,
      bStart: j + 1,
      bLines: 0,
      removed: [],
      added: [],
    };
    while (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      hunk.removed.push(a[i++]);
      hunk.aLines++;
      if (i < n && j < m && a[i] === b[j]) break;
    }
    while (
      j < m &&
      (i >= n || lcs[i + 1][j] < lcs[i][j + 1] || a[i] === undefined || a[i] !== b[j])
    ) {
      if (i < n && a[i] === b[j]) break;
      hunk.added.push(b[j++]);
      hunk.bLines++;
    }
    hunks.push(hunk);
  }
  return hunks;
}

const MAX_LINES = 20_000;

const command = 'diff <fileA> <fileB>';
const describe = 'Line diff of two files as structured hunks (summary first, not a wall of text)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('fileA', { describe: 'Old file', type: 'string' })
    .positional('fileB', { describe: 'New file', type: 'string' })
    .option('summary', {
      alias: 's',
      describe: 'Only counts + hunk locations (no line content)',
      type: 'boolean',
      default: false,
    })
    .example('mfn diff old.json new.json --json', 'structured hunks')
    .example('mfn diff a.txt b.txt -s --json', 'just how much changed, and where');

const handler = async (argv: any) => {
  for (const f of [argv.fileA, argv.fileB]) {
    if (isSensitivePath(String(f))) {
      return fail(argv, 'SensitivePath', sensitivePathMessage(String(f)), 2);
    }
  }
  let aText: string;
  let bText: string;
  try {
    [aText, bText] = await Promise.all([
      readFile(String(argv.fileA), 'utf8'),
      readFile(String(argv.fileB), 'utf8'),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  const a = aText.split('\n');
  const b = bText.split('\n');
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return fail(argv, 'FileTooLarge', `diff is capped at ${MAX_LINES} lines per file.`, 2);
  }

  const identical = aText === bText;
  const hunks = identical ? [] : diffLines(a, b);
  const removed = hunks.reduce((s, h) => s + h.removed.length, 0);
  const added = hunks.reduce((s, h) => s + h.added.length, 0);

  const summaryHunks = hunks.map((h) =>
    argv.summary ? { aStart: h.aStart, aLines: h.aLines, bStart: h.bStart, bLines: h.bLines } : h,
  );

  emit(
    argv,
    {
      fileA: String(argv.fileA),
      fileB: String(argv.fileB),
      identical,
      hunkCount: hunks.length,
      linesAdded: added,
      linesRemoved: removed,
      hunks: summaryHunks,
    },
    () => {
      if (identical) return console.log('files are identical');
      console.log(`${hunks.length} hunk(s) · +${added} −${removed}`);
      for (const h of hunks) {
        console.log(`@@ -${h.aStart},${h.aLines} +${h.bStart},${h.bLines} @@`);
        if (!argv.summary) {
          h.removed.forEach((l) => console.log(`- ${l}`));
          h.added.forEach((l) => console.log(`+ ${l}`));
        }
      }
    },
  );
};

const diff = { command, describe, builder, handler };

export default diff;
