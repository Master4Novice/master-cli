import { Logger, colorQuestions } from '../utility';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';
import { parseToEpoch, convertEpochToTimezone, getEpochNow } from '@master4n/temporal-transformer';

const logger = Logger();

const DEFAULT_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const localZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

interface DateArgs {
  from?: string;
  inFormat?: string;
  inTz?: string;
  tz?: string;
  format?: string;
  json?: boolean;
}

/**
 * Resolve the input to an epoch (ms), then render it in both UTC and a target
 * timezone with the chosen format. `from` omitted ⇒ now.
 */
function runDate(argv: DateArgs): void {
  const format = argv.format || DEFAULT_FORMAT;
  const targetTz = argv.tz || localZone();

  let epochMs: number;
  try {
    if (argv.from !== undefined) {
      epochMs = parseToEpoch(String(argv.from), argv.inFormat, argv.inTz).epochInMilliseconds;
    } else {
      epochMs = getEpochNow().milliseconds;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error ? error.name : 'ParseError';
    return fail(argv, code, message, 2); // bad input → usage error
  }

  let utc: string;
  let zoned: string;
  try {
    utc = convertEpochToTimezone(epochMs, 'UTC', format);
    zoned = convertEpochToTimezone(epochMs, targetTz, format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error ? error.name : 'TimezoneError';
    return fail(argv, code, message, 2); // bad input (e.g. unknown timezone) → usage error
  }

  emit(
    argv,
    {
      epochInSeconds: Math.floor(epochMs / 1000),
      epochInMilliseconds: epochMs,
      utc,
      zoned,
      timezone: targetTz,
      format,
    },
    () => {
      logger.info('Date conversion');
      console.table([{ UTC: utc, [targetTz]: zoned, Epoch_ms: epochMs }]);
    },
  );
}

/** TTY-only fallback when no input flags are supplied. */
async function interactive(argv: DateArgs): Promise<void> {
  // inquirer is TTY-only — lazy import keeps headless invocations fast.
  const { default: inquirer } = await import('inquirer');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'from',
      message: colorQuestions('Date string (blank = now, ISO 8601):'),
    },
    {
      type: 'input',
      name: 'tz',
      message: colorQuestions(`Target timezone (blank = ${localZone()}):`),
    },
    {
      type: 'input',
      name: 'format',
      message: colorQuestions(`Output format (blank = ${DEFAULT_FORMAT}):`),
    },
  ]);
  runDate({
    ...argv,
    from: answers.from?.trim() || undefined,
    tz: answers.tz?.trim() || undefined,
    format: answers.format?.trim() || undefined,
  });
}

const command = 'date [from]';
const describe = 'Convert/format a date across timezones (defaults to now)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('from', {
      describe: 'Date string to convert (ISO 8601 unless --in-format given). Omit for now.',
      type: 'string',
    })
    .option('tz', { type: 'string', describe: 'Target output timezone (IANA; default: local)' })
    .option('format', { type: 'string', describe: `Output format (default: ${DEFAULT_FORMAT})` })
    .option('in-format', { type: 'string', describe: 'Luxon parse format for the input' })
    .option('in-tz', { type: 'string', describe: 'Timezone used to interpret the input' })
    .example('mfn date --json', 'now, in UTC + local')
    .example('mfn date 2024-07-04T15:30:30Z --tz America/New_York --json', 'convert to a timezone');

const handler = async (argv: any) => {
  const args: DateArgs = {
    from: argv.from,
    inFormat: argv['in-format'],
    inTz: argv['in-tz'],
    tz: argv.tz,
    format: argv.format,
    json: argv.json,
  };
  // With no input AND on a TTY (and not --json), offer the interactive flow.
  if (
    argv.from === undefined &&
    argv.tz === undefined &&
    argv.format === undefined &&
    canPrompt(argv)
  ) {
    return interactive(args);
  }
  runDate(args);
};

const date = { command, describe, builder, handler };

export default date;
