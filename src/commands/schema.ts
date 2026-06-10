import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

/**
 * Infer a compact dot-path → type sketch of a JSON document. Arrays are
 * sampled (first MAX_SAMPLE elements) and merged, so a 10MB API response
 * becomes a ~20-line shape an agent can reason about without reading it.
 */
const MAX_SAMPLE = 50;
const MAX_PATHS = 500;

function typeName(v: unknown): string {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}

function walk(value: unknown, prefix: string, out: Map<string, Set<string>>): void {
  if (out.size >= MAX_PATHS) return;
  const t = typeName(value);
  const key = prefix === '' ? '.' : prefix;
  if (!out.has(key)) out.set(key, new Set());
  out.get(key)!.add(t);

  if (t === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, prefix === '' ? k : `${prefix}.${k}`, out);
    }
  } else if (t === 'array') {
    const arr = value as unknown[];
    out.get(key)!.delete('array');
    out.get(key)!.add(`array(${arr.length})`);
    for (const item of arr.slice(0, MAX_SAMPLE)) {
      walk(item, `${prefix}[]`, out);
    }
  }
}

const command = 'schema [query]';
const describe = 'Infer the shape of a JSON document (paths + types) without dumping the data';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('query', {
      describe: 'Optional dot-path to start from (see `mfn json`)',
      type: 'string',
    })
    .option('file', {
      alias: 'f',
      describe: 'Read JSON from this file (default: stdin)',
      type: 'string',
    })
    .example('mfn schema -f response.json --json', 'shape of a big API payload, not its content')
    .example('curl -s api/users | mfn schema --json', 'what fields does this API return?');

const handler = async (argv: any) => {
  let raw: string;
  try {
    if (argv.file !== undefined) {
      raw = await readFile(String(argv.file), 'utf8');
    } else {
      raw = await readStdin();
      if (!raw)
        return fail(argv, 'MissingInput', 'Provide --file <path> or pipe JSON via stdin.', 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'InvalidJSON', `Input is not valid JSON: ${message}`);
  }

  // Optional sub-path start (same dot/bracket syntax as `mfn json`).
  if (argv.query) {
    const parts = String(argv.query)
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean);
    for (const p of parts) {
      if (doc === null || typeof doc !== 'object' || !(p in (doc as object))) {
        return fail(argv, 'PathNotFound', `No value at path "${argv.query}".`);
      }
      doc = (doc as Record<string, unknown>)[p];
    }
  }

  const out = new Map<string, Set<string>>();
  walk(doc, '', out);
  const paths = [...out.entries()].map(([path, types]) => ({
    path,
    type: [...types].sort().join(' | '),
  }));

  emit(
    argv,
    {
      source: argv.file ? `file:${argv.file}` : 'stdin',
      bytes: raw.length,
      pathCount: paths.length,
      truncated: out.size >= MAX_PATHS,
      paths,
    },
    () => {
      for (const p of paths) console.log(`${p.path.padEnd(40)} ${p.type}`);
    },
  );
};

const schema = { command, describe, builder, handler };

export default schema;
