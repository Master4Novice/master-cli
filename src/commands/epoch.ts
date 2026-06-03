import inquirer from 'inquirer';
import { Logger, colorQuestions } from '../utility';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';
import { convertEpoch, parseToEpoch } from '@master4n/temporal-transformer';

const logger = Logger();

/** epoch number -> human-readable date (unit auto-detected). */
function epochToDate(argv: any, value: number): void {
  let result;
  try {
    result = convertEpoch(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // temporal-transformer v2 rejects fractional/out-of-range epochs with a
    // clear name; surface it as the machine error code.
    const code = error instanceof Error ? error.name : 'InvalidEpoch';
    return fail(argv, code, message);
  }
  emit(
    argv,
    {
      epoch: result.epoch,
      unit: result.epochUnit,
      utc: result.dateTimeInGMT,
      local: result.dateTime,
      timezone: result.timezone,
      relative: result.relative,
    },
    () => {
      logger.info('Epoch → date');
      console.table([
        {
          Epoch: `${result.epoch} (${result.epochUnit})`,
          Local: result.dateTime,
          GMT: result.dateTimeInGMT,
          Relative: result.relative,
        },
      ]);
    },
  );
}

/** date string -> epoch values (strict ISO unless a format is given). */
function dateToEpoch(argv: any, input: string, format?: string, tz?: string): void {
  let result;
  try {
    result = parseToEpoch(input, format, tz);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error ? error.name : 'ParseError';
    return fail(argv, code, message);
  }
  // Reuse the same relative-time string the epoch→date path emits, so both
  // directions share a consistent shape (utc/local/timezone/relative).
  let relative: string | undefined;
  try {
    relative = convertEpoch(result.epochInSeconds).relative;
  } catch {
    relative = undefined;
  }
  emit(
    argv,
    {
      epochInSeconds: result.epochInSeconds,
      epochInMilliseconds: result.epochInMilliseconds,
      utc: result.dateTimeInGMT,
      local: result.dateTime,
      timezone: result.timezone,
      relative,
    },
    () => {
      logger.info('Date → epoch');
      console.table([
        {
          Seconds: result.epochInSeconds,
          Milliseconds: result.epochInMilliseconds,
          Local: result.dateTime,
          GMT: result.dateTimeInGMT,
          Timezone: result.timezone,
        },
      ]);
    },
  );
}

/** TTY-only fallback when no flags/positional are supplied. */
async function interactive(argv: any): Promise<void> {
  const { operation } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'operation',
      message: colorQuestions('What do you want to do?'),
      choices: [
        { name: 'Convert epoch → human-readable date', value: 'epochToDate' },
        { name: 'Convert date string → epoch', value: 'dateToEpoch' },
      ],
    },
  ]);
  if (operation === 'epochToDate') {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: colorQuestions('Enter epoch value:'),
        validate: (v: string) => (v.trim() && !isNaN(Number(v))) || 'Enter a number',
      },
    ]);
    epochToDate(argv, Number(value));
  } else {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: colorQuestions('Enter a date string (ISO 8601):'),
        validate: (v: string) => Boolean(v.trim()) || 'Enter a date string',
      },
    ]);
    dateToEpoch(argv, input, undefined, argv.tz);
  }
}

const command = 'epoch [value]';
const describe = 'Convert between epoch timestamps and dates (auto-detects unit)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('value', {
      describe: 'Epoch value to convert to a date (s / ms / µs / ns auto-detected)',
      type: 'number',
    })
    .option('from', {
      type: 'string',
      describe: 'A date string to convert TO epoch (ISO 8601 unless --format given)',
    })
    .option('format', {
      type: 'string',
      describe: 'Luxon parse format for --from (e.g. "dd/MM/yyyy")',
    })
    .option('tz', {
      type: 'string',
      describe: 'IANA timezone used to interpret --from (default: local)',
    })
    .example('mfn epoch 1622547800 --json', 'epoch → date')
    .example('mfn epoch --from 2021-06-01T11:43:20Z --json', 'date → epoch');

const handler = async (argv: any) => {
  if (argv.from !== undefined) {
    return dateToEpoch(argv, String(argv.from), argv.format, argv.tz);
  }
  if (argv.value !== undefined && argv.value !== null) {
    return epochToDate(argv, Number(argv.value));
  }
  if (canPrompt(argv)) {
    return interactive(argv);
  }
  fail(
    argv,
    'MissingInput',
    'Provide an epoch <value>, or --from <dateString>. See `mfn epoch --help`.',
    2,
  );
};

const epoch = { command, describe, builder, handler };

export default epoch;
