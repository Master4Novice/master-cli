/**
 * Minimal, dependency-free 5-field cron engine (minute hour day-of-month month
 * day-of-week). Supports * , - / lists, ranges, and steps. Standard semantics:
 * when BOTH dom and dow are restricted, a date matches if EITHER matches (Vixie
 * cron rule).
 */
export interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

const RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week (0 = Sunday; 7 normalised to 0)
];

const MONTH_NAMES = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
const DOW_NAMES = 'SUN MON TUE WED THU FRI SAT'.split(' ');

function resolveName(token: string, fieldIndex: number): string {
  const up = token.toUpperCase();
  if (fieldIndex === 3) {
    const i = MONTH_NAMES.indexOf(up);
    if (i >= 0) return String(i + 1);
  }
  if (fieldIndex === 4) {
    const i = DOW_NAMES.indexOf(up);
    if (i >= 0) return String(i);
  }
  return token;
}

// Expand one cron field ("*/5", "1-10/2", "MON,WED") into a set of values.
function expandField(field: string, fieldIndex: number): Set<number> {
  const [lo, hi] = RANGES[fieldIndex];
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1)
      throw new Error(`Invalid step "${stepPart}" in "${part}"`);
    let start: number;
    let end: number;
    if (rangePart === '*' || rangePart === '') {
      start = lo;
      end = hi;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-').map((t) => Number(resolveName(t, fieldIndex)));
      start = a;
      end = b;
    } else {
      start = end = Number(resolveName(rangePart, fieldIndex));
      if (stepPart !== undefined) end = hi; // "N/step" means start at N
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`Invalid value in "${part}"`);
    }
    // Normalise dow 7 → 0 (both mean Sunday).
    if (fieldIndex === 4) {
      if (start === 7) start = 0;
      if (end === 7) end = 0;
    }
    if (start < lo || end > hi || start > end) {
      throw new Error(`"${part}" out of range ${lo}-${hi}`);
    }
    for (let v = start; v <= end; v += step) out.add(v);
  }
  return out;
}

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export function parseCron(expression: string): CronFields {
  const expr = ALIASES[expression.trim().toLowerCase()] ?? expression.trim();
  const fields = expr.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 fields (minute hour dom month dow), got ${fields.length}`);
  }
  return {
    minute: expandField(fields[0], 0),
    hour: expandField(fields[1], 1),
    dayOfMonth: expandField(fields[2], 2),
    month: expandField(fields[3], 3),
    dayOfWeek: expandField(fields[4], 4),
    domRestricted: fields[2] !== '*',
    dowRestricted: fields[4] !== '*',
  };
}

function dateMatches(f: CronFields, d: Date): boolean {
  if (!f.month.has(d.getMonth() + 1)) return false;
  const domOk = f.dayOfMonth.has(d.getDate());
  const dowOk = f.dayOfWeek.has(d.getDay());
  // Vixie rule: both restricted → OR; otherwise both must hold.
  if (f.domRestricted && f.dowRestricted) return domOk || dowOk;
  return domOk && dowOk;
}

/** Next `count` run times strictly after `from` (local time), bounded to 5 years. */
export function nextRuns(f: CronFields, from: Date, count: number): Date[] {
  const out: Date[] = [];
  const cur = new Date(from);
  cur.setSeconds(0, 0);
  cur.setMinutes(cur.getMinutes() + 1);
  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 5);
  while (out.length < count && cur <= limit) {
    if (!dateMatches(f, cur)) {
      // Skip to next day at 00:00 — date can't match at any time today.
      cur.setHours(0, 0, 0, 0);
      cur.setDate(cur.getDate() + 1);
      continue;
    }
    if (!f.hour.has(cur.getHours())) {
      cur.setMinutes(0);
      cur.setHours(cur.getHours() + 1);
      continue;
    }
    if (!f.minute.has(cur.getMinutes())) {
      cur.setMinutes(cur.getMinutes() + 1);
      continue;
    }
    out.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + 1);
  }
  return out;
}
