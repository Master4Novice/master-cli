import inquirer from 'inquirer';
import {
  Logger,
  colorQuestions,
  getCacheDirectory,
  saveIgnoresToCache,
} from '../utility';
import fuzzy from 'fuzzy';
import fs from 'fs-extra';
import path from 'path';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';

const logger = Logger();
const SC_IGNORE_CACHE = path.join(getCacheDirectory(), 'sc_ignore.json');
const DEFAULT_IGNORES = ['node_modules', '.git', 'dist', 'build', '.nx', 'coverage'];

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

/**
 * TTY-only interactive picker: ask for a fuzzy filter, then choose from the
 * matches. Uses inquirer's built-in input + list prompts (no inquirer-fuzzy-path,
 * which dragged in an ancient inquirer@6 → external-editor → tmp chain).
 */
async function interactive(
  argv: any,
  root: string,
  ignores: string[],
  depth: number,
  limit: number,
): Promise<void> {
  const all = walk(root, ignores, depth);
  const { pattern } = await inquirer.prompt([
    { type: 'input', name: 'pattern', message: colorQuestions('Filter (fuzzy, blank = all):') },
  ]);
  const term = String(pattern ?? '').trim();
  const matched = term ? fuzzy.filter(term, all).map((r) => r.original) : all;
  const choices = matched.slice(0, limit);
  if (choices.length === 0) {
    return emit(argv, { pattern: term || null, root, count: 0, matches: [] }, () =>
      logger.warn('No matches.'),
    );
  }
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: colorQuestions('Select a path:'),
      choices,
      pageSize: 15,
      loop: false,
    },
  ]);
  const stats = fs.statSync(path.join(root, selected));
  emit(argv, { path: selected, type: stats.isDirectory() ? 'directory' : 'file' }, () => {
    logger.info(`${stats.isDirectory() ? 'Directory' : 'File'}: ${selected}`);
    if (stats.isDirectory()) logger.info(`cd ${selected}`);
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
    return interactive(argv, root, ignores, depth, limit);
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
