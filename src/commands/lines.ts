import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail } from '../utility/io';
import { isSensitivePath, sensitivePathMessage } from '../utility/guard';

// A range cap keeps one call from dumping an entire huge file back into an
// agent's context — the whole point of the command is reading less.
const MAX_SPAN = 2000;

const command = 'lines <file>';
const describe = 'Read an exact line range of a file (1-based, inclusive) — not the whole file';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('file', { describe: 'File to read from', type: 'string' })
    .option('start', { alias: 's', describe: 'First line (1-based)', type: 'number', default: 1 })
    .option('end', {
      alias: 'e',
      describe: 'Last line (inclusive; default start+99)',
      type: 'number',
    })
    .option('count', {
      alias: 'n',
      describe: 'Number of lines from --start (alternative to --end)',
      type: 'number',
    })
    .example('mfn lines src/app.ts -s 120 -n 30 --json', '30 lines starting at line 120')
    .example('mfn lines error.log -s 1 -e 50 --json', 'first 50 lines');

const handler = async (argv: any) => {
  const start = Number(argv.start);
  if (!Number.isInteger(start) || start < 1) {
    return fail(argv, 'InvalidStart', '--start must be a positive integer (1-based).', 2);
  }
  if (argv.end !== undefined && argv.count !== undefined) {
    return fail(argv, 'ConflictingFlags', 'Use --end OR --count, not both.', 2);
  }
  let end: number;
  if (argv.end !== undefined) {
    end = Number(argv.end);
    if (!Number.isInteger(end) || end < start) {
      return fail(argv, 'InvalidEnd', '--end must be an integer >= --start.', 2);
    }
  } else if (argv.count !== undefined) {
    const count = Number(argv.count);
    if (!Number.isInteger(count) || count < 1) {
      return fail(argv, 'InvalidCount', '--count must be a positive integer.', 2);
    }
    end = start + count - 1;
  } else {
    end = start + 99;
  }
  if (end - start + 1 > MAX_SPAN) {
    return fail(
      argv,
      'RangeTooLarge',
      `Range spans ${end - start + 1} lines; max is ${MAX_SPAN}.`,
      2,
    );
  }

  const file = String(argv.file);
  if (isSensitivePath(file)) {
    return fail(argv, 'SensitivePath', sensitivePathMessage(file), 2);
  }
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  const all = text.split('\n');
  // A trailing newline produces one phantom empty element — don't count it.
  const totalLines = text.endsWith('\n') ? all.length - 1 : all.length;
  if (start > totalLines) {
    return fail(
      argv,
      'OutOfRange',
      `--start ${start} is beyond the file (${totalLines} lines).`,
      2,
    );
  }
  const effectiveEnd = Math.min(end, totalLines);
  const slice = all.slice(start - 1, effectiveEnd);

  emit(
    argv,
    {
      file: String(argv.file),
      start,
      end: effectiveEnd,
      requestedEnd: end,
      totalLines,
      lineCount: slice.length,
      content: slice.join('\n'),
    },
    () => slice.forEach((line, i) => console.log(`${start + i}\t${line}`)),
  );
};

const lines = { command, describe, builder, handler };

export default lines;
