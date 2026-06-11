import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const DEFAULT_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.nx']);
const MAX_FILES = 10_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Convert a glob ("src/**\/*.ts") to a RegExp. Supports ** , * and ?.
 * Single-pass tokenizer — sequential string replaces corrupt each other
 * (the later `?` rule would rewrite the `(?:…)` emitted for `**`).
 */
function globToRegExp(glob: string): RegExp {
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const followedBySlash = glob[i + 2] === '/';
        out += followedBySlash ? '(?:.*/)?' : '.*';
        i += followedBySlash ? 3 : 2;
      } else {
        out += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      out += '[^/]';
      i++;
    } else {
      // Escape a single literal char. (Operating per-character, so this is a
      // complete escape — no global-flag sanitization gap.)
      out += /[.+^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch;
      i++;
    }
  }
  return new RegExp(`^${out}$`);
}

function walk(root: string): string[] {
  const files: string[] = [];
  const recurse = (dir: string) => {
    if (files.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (DEFAULT_IGNORES.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) recurse(abs);
      else if (e.isFile()) files.push(abs);
    }
  };
  recurse(root);
  return files;
}

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const command = 'replace <search> <replacement>';
const describe = 'Literal find/replace across files — DRY-RUN by default, --write to apply';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('search', { describe: 'Literal text to find (not a regex)', type: 'string' })
    .positional('replacement', { describe: 'Literal replacement text', type: 'string' })
    .option('glob', {
      alias: 'g',
      describe: 'File glob relative to cwd (e.g. "src/**/*.ts")',
      type: 'string',
      demandOption: true,
    })
    .option('write', {
      alias: 'w',
      describe: 'Actually modify files (default: dry-run report)',
      type: 'boolean',
      default: false,
    })
    .example('mfn replace oldName newName -g "src/**/*.ts" --json', 'dry-run: where + how many')
    .example('mfn replace oldName newName -g "src/**/*.ts" -w --json', 'apply the replacement');

const handler = (argv: any) => {
  const search = String(argv.search);
  const replacement = String(argv.replacement);
  if (search === '') return fail(argv, 'MissingInput', 'Search text must not be empty.', 2);
  if (search === replacement) {
    return fail(argv, 'NoOp', 'Search and replacement are identical.', 2);
  }

  const root = process.cwd();
  const matcher = globToRegExp(String(argv.glob).replace(/^\.\//, ''));
  const re = new RegExp(escapeForRegex(search), 'g');

  const changes: { file: string; count: number }[] = [];
  let totalReplacements = 0;
  const errors: { file: string; error: string }[] = [];

  for (const abs of walk(root)) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (!matcher.test(rel)) continue;
    // Operate on a single file descriptor — fstat/read/write all target the
    // SAME open file, so there is no time-of-check/time-of-use race between a
    // path check and a later path use (CodeQL js/file-system-race).
    let fd: number;
    try {
      fd = fs.openSync(abs, argv.write ? 'r+' : 'r');
    } catch {
      continue; // vanished / unreadable since the directory walk
    }
    try {
      if (fs.fstatSync(fd).size > MAX_FILE_BYTES) continue;
      const text = fs.readFileSync(fd, 'utf8');
      const count = (text.match(re) ?? []).length;
      if (count === 0) continue;
      if (argv.write) {
        const updated = text.split(search).join(replacement);
        fs.ftruncateSync(fd, 0);
        fs.writeSync(fd, updated, 0, 'utf8');
      }
      changes.push({ file: rel, count });
      totalReplacements += count;
    } catch (error) {
      // A read-only failure (binary/unreadable) is a silent skip; a write
      // failure is reported so the caller knows the change didn't land.
      if (argv.write) {
        errors.push({ file: rel, error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  emit(
    argv,
    {
      search,
      replacement,
      glob: String(argv.glob),
      mode: argv.write ? 'written' : 'dry-run',
      fileCount: changes.length,
      totalReplacements,
      changes,
      errors,
    },
    () => {
      console.log(
        `${argv.write ? 'replaced' : 'would replace'} ${totalReplacements} occurrence(s) in ${changes.length} file(s)`,
      );
      for (const c of changes) console.log(`  ${c.count}× ${c.file}`);
      if (!argv.write && changes.length) console.log('re-run with --write to apply');
    },
  );

  if (errors.length > 0) process.exit(1);
};

const replace = { command, describe, builder, handler };

export default replace;
