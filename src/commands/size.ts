import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const DEFAULT_IGNORES = new Set(['node_modules', '.git', '.nx', 'dist', 'build', 'coverage']);
const MAX_ENTRIES = 200_000;

interface FileEntry {
  path: string;
  bytes: number;
}

/** Walk the tree collecting file sizes (symlinks not followed; errors skipped). */
function collect(root: string, extraIgnores: string[]): { files: FileEntry[]; truncated: boolean } {
  const skip = new Set([...DEFAULT_IGNORES, ...extraIgnores]);
  const files: FileEntry[] = [];
  let truncated = false;
  const recurse = (dir: string) => {
    if (files.length >= MAX_ENTRIES) {
      truncated = true;
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        recurse(abs);
      } else if (e.isFile()) {
        try {
          files.push({ path: path.relative(root, abs), bytes: fs.statSync(abs).size });
        } catch {
          /* vanished/broken entry — skip */
        }
      }
    }
  };
  recurse(root);
  return { files, truncated };
}

const human = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}G`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}M`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${bytes}B`;
};

const command = 'size [dir]';
const describe = 'Total size + largest files/dirs under a directory (one call, not du|sort|head)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('dir', { describe: 'Directory to analyse (default: cwd)', type: 'string' })
    .option('top', {
      alias: 't',
      describe: 'How many largest files/dirs to list',
      type: 'number',
      default: 10,
    })
    .option('ignore', {
      alias: 'i',
      describe: 'Additional directory names to ignore',
      type: 'array',
    })
    .example('mfn size --json', 'where is the disk going in this project?')
    .example('mfn size ./src -t 5 --json', 'five largest files under src');

const handler = (argv: any) => {
  const top = Number(argv.top);
  if (!Number.isInteger(top) || top < 1 || top > 1000) {
    return fail(argv, 'InvalidTop', '--top must be an integer in 1..1000.', 2);
  }
  const root = path.resolve(String(argv.dir ?? process.cwd()));
  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    return fail(argv, 'NotFound', `Directory not found: ${root}`, 2);
  }
  if (!stat.isDirectory()) return fail(argv, 'NotADirectory', `${root} is not a directory.`, 2);

  const { files, truncated } = collect(root, ((argv.ignore as string[]) ?? []).map(String));
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);

  // Aggregate per top-level child directory for the "where does it go" view.
  const dirTotals = new Map<string, number>();
  for (const f of files) {
    const first = f.path.split(path.sep)[0];
    dirTotals.set(first, (dirTotals.get(first) ?? 0) + f.bytes);
  }
  const dirs = [...dirTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, bytes]) => ({ name, bytes, human: human(bytes) }));
  const largest = [...files]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, top)
    .map((f) => ({ path: f.path, bytes: f.bytes, human: human(f.bytes) }));

  emit(
    argv,
    {
      root,
      fileCount: files.length,
      totalBytes,
      totalHuman: human(totalBytes),
      truncated,
      largestFiles: largest,
      byTopLevel: dirs,
    },
    () => {
      console.log(`${root}: ${human(totalBytes)} across ${files.length} files`);
      for (const d of dirs) console.log(`  ${d.human.padStart(8)}  ${d.name}/`);
      console.log('largest files:');
      for (const f of largest) console.log(`  ${f.human.padStart(8)}  ${f.path}`);
    },
  );
};

const size = { command, describe, builder, handler };

export default size;
