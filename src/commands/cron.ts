import { withJsonFlag, emit, fail } from '../utility/io';
import { parseCron, nextRuns, type CronFields } from './cron.engine';

/** Compact plain-English description of the schedule (best-effort, not exhaustive). */
function describeCron(f: CronFields): string {
  const list = (s: Set<number>, max: number) =>
    s.size > max ? 'several values' : [...s].sort((a, b) => a - b).join(',');
  const minutePart =
    f.minute.size === 60
      ? 'every minute'
      : f.minute.size === 1
        ? `at minute ${list(f.minute, 5)}`
        : `at minutes ${list(f.minute, 8)}`;
  const hourPart =
    f.hour.size === 24
      ? 'of every hour'
      : f.hour.size === 1
        ? `past hour ${list(f.hour, 5)}`
        : `past hours ${list(f.hour, 8)}`;
  const domPart = f.domRestricted ? `on day-of-month ${list(f.dayOfMonth, 8)}` : '';
  const monthPart = f.month.size === 12 ? '' : `in month ${list(f.month, 6)}`;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowPart = f.dowRestricted
    ? `on ${[...f.dayOfWeek]
        .sort((a, b) => a - b)
        .map((d) => DOW[d])
        .join(',')}`
    : '';
  return [minutePart, hourPart, domPart, monthPart, dowPart].filter(Boolean).join(' ');
}

const command = 'cron <expression>';
const describe = 'Validate a cron expression, explain it, and compute the next run times';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('expression', {
      describe: '5-field cron (minute hour dom month dow) or @daily/@hourly/@weekly/…',
      type: 'string',
    })
    .option('next', {
      alias: 'n',
      describe: 'How many upcoming run times to compute',
      type: 'number',
      default: 3,
    })
    .example('mfn cron "*/15 9-17 * * 1-5" --json', 'validate + explain + next runs')
    .example('mfn cron "@daily" -n 1 --json', 'when does @daily fire next?');

const handler = (argv: any) => {
  const expression = String(argv.expression).trim();
  const n = Number(argv.next);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    return fail(argv, 'InvalidCount', '--next must be an integer in 0..100.', 2);
  }

  let fields: CronFields;
  try {
    fields = parseCron(expression);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'InvalidCron', `"${expression}" is not valid cron: ${message}`, 2);
  }

  const runs = nextRuns(fields, new Date(), n);
  const description = describeCron(fields);
  const toLocalIso = (d: Date) => {
    const p = (x: number, l = 2) => String(x).padStart(l, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
  };

  emit(
    argv,
    {
      expression,
      valid: true,
      description,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      next: runs.map((d) => ({ local: toLocalIso(d), iso: d.toISOString(), epochMs: d.getTime() })),
    },
    () => {
      console.log(`${expression} → ${description}`);
      for (const d of runs) console.log(toLocalIso(d));
    },
  );
};

const cron = { command, describe, builder, handler };

export default cron;
