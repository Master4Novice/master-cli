import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const DEFAULT_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.nx']);
const MAX_FILES = 200_000;

function age(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const command = 'recent [dir]';
const describe = 'Most recently modified files under a directory, with age';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('dir', { describe: 'Directory to scan (default: cwd)', type: 'string' })
    .option('top', {
      alias: 't',
      describe: 'How many files to return',
      type: 'number',
      default: 10,
    })
    .option('ignore', {
      alias: 'i',
      describe: 'Additional directory names to ignore',
      type: 'array',
    })
    .example('mfn recent --json', 'what changed last in this project?')
    .example('mfn recent ./src -t 5 --json', 'five most recent under src');

const handler = (argv: any) => {
  const top = Number(argv.top);
  if (!Number.isInteger(top) || top < 1 || top > 1000) {
    return fail(argv, 'InvalidTop', '--top must be an integer in 1..1000.', 2);
  }
  const root = path.resolve(String(argv.dir ?? process.cwd()));
  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(root);
  } catch {
    return fail(argv, 'NotFound', `Directory not found: ${root}`, 2);
  }
  if (!rootStat.isDirectory()) return fail(argv, 'NotADirectory', `${root} is not a directory.`, 2);

  const skip = new Set([...DEFAULT_IGNORES, ...((argv.ignore as string[]) ?? []).map(String)]);
  const files: { path: string; mtimeMs: number; bytes: number }[] = [];
  let truncated = false;
  const recurse = (dir: string) => {
    if (files.length >= MAX_FILES) {
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
          const s = fs.statSync(abs);
          files.push({ path: path.relative(root, abs), mtimeMs: s.mtimeMs, bytes: s.size });
        } catch {
          /* vanished — skip */
        }
      }
    }
  };
  recurse(root);

  const now = Date.now();
  const newest = files
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, top)
    .map((f) => ({
      path: f.path,
      bytes: f.bytes,
      modified: new Date(f.mtimeMs).toISOString(),
      age: age(now - f.mtimeMs),
    }));

  emit(argv, { root, fileCount: files.length, truncated, files: newest }, () => {
    for (const f of newest) console.log(`${f.age.padStart(8)}  ${f.path}`);
  });
};

const recent = { command, describe, builder, handler };

export default recent;
