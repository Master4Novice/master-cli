import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const DEFAULT_IGNORES = new Set(['node_modules', '.git', '.nx', 'dist', 'build', 'coverage']);
const MAX_ENTRIES = 200_000;

/**
 * Count files and bytes per extension — a one-call answer to "what kind of
 * project is this?" that otherwise costs an agent a find|sed|sort|uniq pipeline.
 */
function tally(
  root: string,
  extraIgnores: string[],
): { byExt: Map<string, { count: number; bytes: number }>; total: number; truncated: boolean } {
  const skip = new Set([...DEFAULT_IGNORES, ...extraIgnores]);
  const byExt = new Map<string, { count: number; bytes: number }>();
  let total = 0;
  let truncated = false;
  const recurse = (dir: string) => {
    if (total >= MAX_ENTRIES) {
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
        const ext = path.extname(e.name).toLowerCase() || '(none)';
        let bytes = 0;
        try {
          bytes = fs.statSync(abs).size;
        } catch {
          /* vanished entry */
        }
        const cur = byExt.get(ext) ?? { count: 0, bytes: 0 };
        cur.count++;
        cur.bytes += bytes;
        byExt.set(ext, cur);
        total++;
      }
    }
  };
  recurse(root);
  return { byExt, total, truncated };
}

const command = 'ext [dir]';
const describe =
  'File counts and bytes per extension — "what kind of project is this?" in one call';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('dir', { describe: 'Directory to analyse (default: cwd)', type: 'string' })
    .option('ignore', {
      alias: 'i',
      describe: 'Additional directory names to ignore',
      type: 'array',
    })
    .example('mfn ext --json', 'project composition by file type');

const handler = (argv: any) => {
  const root = path.resolve(String(argv.dir ?? process.cwd()));
  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    return fail(argv, 'NotFound', `Directory not found: ${root}`, 2);
  }
  if (!stat.isDirectory()) return fail(argv, 'NotADirectory', `${root} is not a directory.`, 2);

  const { byExt, total, truncated } = tally(root, ((argv.ignore as string[]) ?? []).map(String));
  const extensions = [...byExt.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([ext, v]) => ({ ext, count: v.count, bytes: v.bytes }));

  emit(argv, { root, fileCount: total, truncated, extensions }, () => {
    console.log(`${total} files under ${root}`);
    for (const e of extensions.slice(0, 20)) {
      console.log(`  ${String(e.count).padStart(6)}  ${e.ext}`);
    }
  });
};

const ext = { command, describe, builder, handler };

export default ext;
