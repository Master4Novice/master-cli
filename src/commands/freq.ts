import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

const command = 'freq [file]';
const describe =
  'Most frequent lines of a file/stdin (log analysis without sort|uniq -c|sort|head)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('file', { describe: 'File to analyse (or pipe via stdin)', type: 'string' })
    .option('top', {
      alias: 't',
      describe: 'How many entries to return',
      type: 'number',
      default: 10,
    })
    .option('min', {
      alias: 'm',
      describe: 'Only lines occurring at least this often',
      type: 'number',
      default: 1,
    })
    .option('trim', {
      describe: 'Trim whitespace before counting (default true)',
      type: 'boolean',
      default: true,
    })
    .example('mfn freq error.log -t 5 --json', 'the 5 most repeated log lines')
    .example('grep ERROR app.log | mfn freq --json', 'most frequent error messages');

const handler = async (argv: any) => {
  const top = Number(argv.top);
  const min = Number(argv.min);
  if (!Number.isInteger(top) || top < 1 || top > 10_000) {
    return fail(argv, 'InvalidTop', '--top must be an integer in 1..10000.', 2);
  }
  if (!Number.isInteger(min) || min < 1) {
    return fail(argv, 'InvalidMin', '--min must be a positive integer.', 2);
  }

  let text: string;
  let source: string;
  try {
    if (argv.file !== undefined) {
      text = await readFile(String(argv.file), 'utf8');
      source = `file:${argv.file}`;
    } else {
      text = await readStdin();
      if (!text) return fail(argv, 'MissingInput', 'Provide a file or pipe stdin.', 2);
      source = 'stdin';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  const counts = new Map<string, number>();
  let totalLines = 0;
  for (const raw of text.split('\n')) {
    const line = argv.trim ? raw.trim() : raw;
    if (line === '') continue;
    totalLines++;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  const entries = [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([line, count]) => ({ count, line }));

  emit(
    argv,
    { source, totalLines, uniqueLines: counts.size, returned: entries.length, entries },
    () => {
      for (const e of entries) console.log(`${String(e.count).padStart(7)}  ${e.line}`);
    },
  );
};

const freq = { command, describe, builder, handler };

export default freq;
