import inquirer from 'inquirer';
import {
  Logger,
  colorQuestions,
  getCacheDirectory,
  saveIgnoresToCache,
} from '../utility';
import fuzzyPath from 'inquirer-fuzzy-path';
import fuzzy from 'fuzzy';
import fs from 'fs-extra';
import path from 'path';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';

const logger = Logger();
const SC_IGNORE_CACHE = path.join(getCacheDirectory(), 'sc_ignore.json');
const DEFAULT_IGNORES = ['node_modules', '.git', 'dist', 'build', '.nx', 'coverage'];

inquirer.registerPrompt('fuzzypath', fuzzyPath);

interface SCIgnore {
  ignores: string[];
}

async function getIgnoresFromCache(): Promise<SCIgnore> {
  try {
    return await fs.readJson(SC_IGNORE_CACHE);
  } catch (error: any) {
    if (error.code === 'ENOENT') return { ignores: [] };
    throw error;
  }
}

/** Recursively collect relative paths under `root`, honouring ignores + depth. */
function walk(root: string, ignores: string[], maxDepth: number): string[] {
  const out: string[] = [];
  const skip = new Set([...DEFAULT_IGNORES, ...ignores]);
  const recurse = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      out.push(entry.isDirectory() ? rel + path.sep : rel);
      if (entry.isDirectory()) recurse(abs, depth + 1);
    }
  };
  recurse(root, 0);
  return out;
}

/** TTY-only interactive fuzzy picker (prints the chosen path). */
async function interactive(argv: any, root: string, ignores: string[]): Promise<void> {
  const { filePath } = await inquirer.prompt([
    {
      type: 'fuzzypath',
      name: 'filePath',
      excludePath: (nodePath: string) => ignores.some((e) => nodePath.includes(e)),
      excludeFilter: (nodePath: string) => nodePath === '.',
      message: colorQuestions('Select a folder/file:'),
      itemType: 'any',
      depthLimit: 5,
      rootPath: root,
    },
  ]);
  const stats = fs.statSync(filePath);
  emit(argv, { path: filePath, type: stats.isDirectory() ? 'directory' : 'file' }, () => {
    logger.info(`${stats.isDirectory() ? 'Directory' : 'File'}: ${filePath}`);
    if (stats.isDirectory()) logger.info(`cd ${filePath}`);
  });
}

const command = 'sc [pattern]';
const describe = 'Find files/folders under the current directory (fuzzy match)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('pattern', {
      describe: 'Fuzzy pattern to match against paths (omit to list all)',
      type: 'string',
    })
    .option('ignore', {
      alias: 'i',
      describe: 'Additional directory names to ignore',
      type: 'array',
    })
    .option('depth', { type: 'number', default: 6, describe: 'Max recursion depth' })
    .option('limit', { type: 'number', default: 500, describe: 'Max results returned' })
    .example('mfn sc service --json', 'find paths matching "service"');

const handler = async (argv: any) => {
  const root = process.cwd();

  // Validate numeric flags up front — silently slicing on a negative/zero
  // limit (or a negative depth) produced misleading "truncated"/empty results.
  const depth = Number(argv.depth);
  const limit = Number(argv.limit);
  if (!Number.isInteger(depth) || depth < 0) {
    return fail(argv, 'InvalidDepth', '--depth must be a non-negative integer.', 2);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return fail(argv, 'InvalidLimit', '--limit must be a positive integer.', 2);
  }

  let ignores = (argv.ignore as string[]) ?? [];
  if (ignores.length > 0) {
    await saveIgnoresToCache({ ignores }, SC_IGNORE_CACHE).catch(() => {});
  } else {
    ignores = (await getIgnoresFromCache()).ignores ?? [];
  }

  // Headless when a pattern is given or output isn't a terminal; else interactive.
  if (argv.pattern === undefined && canPrompt(argv)) {
    return interactive(argv, root, ignores);
  }

  const all = walk(root, ignores, depth);
  const matched = argv.pattern
    ? fuzzy.filter(String(argv.pattern), all).map((r) => r.original)
    : all;
  const matches = matched.slice(0, limit);

  emit(
    argv,
    { pattern: argv.pattern ?? null, root, count: matches.length, truncated: matched.length > matches.length, matches },
    () => {
      logger.info(`${matches.length} match(es) under ${root}`);
      for (const m of matches) console.log(m);
    },
  );
};

const sc = { command, describe, builder, handler };

export default sc;
