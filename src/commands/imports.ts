import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail } from '../utility/io';

const IMPORT_RE =
  /(?:import\s[\s\S]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[\s\S]*?from\s*)['"]([^'"]+)['"]/g;
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const DEFAULT_IGNORES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.nx']);
const MAX_FILES = 20_000;

function extractImports(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(IMPORT_RE)) out.add(m[1]);
  return [...out];
}

/** All source files under root (bounded, ignores applied). */
function sourceFiles(root: string): string[] {
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
      else if (e.isFile() && SOURCE_EXTS.has(path.extname(e.name))) files.push(abs);
    }
  };
  recurse(root);
  return files;
}

const command = 'imports [file]';
const describe = 'List a file’s imports, or (--who <module>) every file importing a module';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('file', { describe: 'Source file to list imports of', type: 'string' })
    .option('who', {
      alias: 'w',
      describe: 'Reverse mode: find files under cwd whose imports contain this string',
      type: 'string',
    })
    .example('mfn imports src/app.ts --json', 'what does this file depend on?')
    .example('mfn imports --who ../utility --json', 'who imports the utility module?');

const handler = async (argv: any) => {
  if (argv.who !== undefined) {
    const needle = String(argv.who);
    if (!needle) return fail(argv, 'MissingInput', '--who needs a module name/substring.', 2);
    const root = process.cwd();
    const importers: { file: string; specifiers: string[] }[] = [];
    for (const abs of sourceFiles(root)) {
      let text: string;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      const hits = extractImports(text).filter((s) => s.includes(needle));
      if (hits.length > 0) importers.push({ file: path.relative(root, abs), specifiers: hits });
    }
    return emit(argv, { module: needle, root, count: importers.length, importers }, () => {
      for (const i of importers) console.log(`${i.file}  ←  ${i.specifiers.join(', ')}`);
    });
  }

  if (argv.file === undefined) {
    return fail(argv, 'MissingInput', 'Provide a <file>, or use --who <module>.', 2);
  }
  const file = String(argv.file);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }
  const specifiers = extractImports(text);
  const grouped = {
    relative: specifiers.filter((s) => s.startsWith('.')),
    packages: specifiers.filter((s) => !s.startsWith('.') && !s.startsWith('node:')),
    builtin: specifiers.filter((s) => s.startsWith('node:')),
  };
  emit(argv, { file, count: specifiers.length, ...grouped }, () => {
    for (const s of specifiers) console.log(s);
  });
};

const imports = { command, describe, builder, handler };

export default imports;
