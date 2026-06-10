import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';
import { isSensitivePath, sensitivePathMessage } from '../utility/guard';

/**
 * Walk a dot/bracket path ("a.b[0].c" or "a.b.0.c") into a parsed JSON value.
 * Returns { found, value } rather than throwing, so a missing key is a clean
 * machine-readable miss instead of a stack trace.
 */
function getPath(root: unknown, query: string): { found: boolean; value: unknown } {
  const parts = query
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((p) => p !== '');
  let cur: any = root;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return { found: false, value: undefined };
    }
    if (!(part in cur)) return { found: false, value: undefined };
    cur = cur[part];
  }
  return { found: true, value: cur };
}

const typeOf = (v: unknown): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

const command = 'json [query]';
const describe = 'Extract a value from JSON (file or stdin) without reading the whole document';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('query', {
      describe: 'Dot/bracket path, e.g. scripts.build or users[0].name (omit for root)',
      type: 'string',
    })
    .option('file', {
      alias: 'f',
      describe: 'Read JSON from this file (default: stdin)',
      type: 'string',
    })
    .option('keys', {
      alias: 'k',
      describe: 'List the keys at the path instead of the value',
      type: 'boolean',
      default: false,
    })
    .option('length', {
      alias: 'l',
      describe: 'Report array length / object key count at the path',
      type: 'boolean',
      default: false,
    })
    .example('mfn json scripts.build -f package.json --json', 'one field from a file')
    .example('cat data.json | mfn json users[0].name --json', 'one field from stdin')
    .example('mfn json dependencies -f package.json --keys --json', 'just the keys');

const handler = async (argv: any) => {
  let raw: string;
  try {
    if (argv.file !== undefined) {
      if (isSensitivePath(String(argv.file))) {
        return fail(argv, 'SensitivePath', sensitivePathMessage(String(argv.file)), 2);
      }
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

  const query = argv.query !== undefined ? String(argv.query) : '';
  const { found, value } = query ? getPath(doc, query) : { found: true, value: doc };
  if (!found) {
    return fail(argv, 'PathNotFound', `No value at path "${query}".`);
  }

  const type = typeOf(value);
  if (argv.keys) {
    if (type !== 'object' && type !== 'array') {
      return fail(
        argv,
        'NotAnObject',
        `Path "${query || '.'}" is ${type}; --keys needs an object/array.`,
        2,
      );
    }
    const keys = Object.keys(value as object);
    return emit(argv, { query: query || null, type, count: keys.length, keys }, () =>
      keys.forEach((k) => console.log(k)),
    );
  }
  if (argv.length) {
    const length =
      type === 'array'
        ? (value as unknown[]).length
        : type === 'object'
          ? Object.keys(value as object).length
          : type === 'string'
            ? (value as string).length
            : null;
    if (length === null) {
      return fail(
        argv,
        'NoLength',
        `Path "${query || '.'}" is ${type}; --length needs array/object/string.`,
        2,
      );
    }
    return emit(argv, { query: query || null, type, length }, () => console.log(length));
  }

  emit(argv, { query: query || null, type, value }, () =>
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2)),
  );
};

const jsonCmd = { command, describe, builder, handler };

export default jsonCmd;
