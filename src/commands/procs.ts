import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const isWin = platform() === 'win32';

interface Proc {
  pid: number;
  cpu: number | null;
  memMB: number | null;
  command: string;
}

/** Unix: one ps call with an explicit format — no parsing surprises. */
async function unixProcs(): Promise<Proc[]> {
  const { stdout } = await run('ps', ['axo', 'pid=,pcpu=,rss=,comm='], {
    timeout: 10_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out: Proc[] = [];
  for (const line of stdout.split('\n')) {
    const m = /^\s*(\d+)\s+([\d.]+)\s+(\d+)\s+(.+)$/.exec(line);
    if (!m) continue;
    out.push({
      pid: Number(m[1]),
      cpu: Number(m[2]),
      memMB: Math.round((Number(m[3]) / 1024) * 10) / 10,
      command: m[4].trim(),
    });
  }
  return out;
}

/** Windows: tasklist CSV (no cpu%, but pid/mem/name are what matter). */
async function winProcs(): Promise<Proc[]> {
  const { stdout } = await run('tasklist', ['/FO', 'CSV', '/NH'], {
    timeout: 10_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out: Proc[] = [];
  for (const line of stdout.split('\n')) {
    const cols = line.match(/"([^"]*)"/g)?.map((c) => c.slice(1, -1));
    if (!cols || cols.length < 5) continue;
    const memKB = Number(cols[4].replace(/[^\d]/g, ''));
    out.push({
      pid: Number(cols[1]),
      cpu: null,
      memMB: Number.isFinite(memKB) ? Math.round((memKB / 1024) * 10) / 10 : null,
      command: cols[0],
    });
  }
  return out;
}

const command = 'procs [pattern]';
const describe = 'Search running processes by name — pid/cpu/mem without ps|grep gymnastics';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('pattern', {
      describe: 'Case-insensitive substring of the command name',
      type: 'string',
    })
    .option('top', {
      alias: 't',
      describe: 'Max results (sorted by cpu, then mem)',
      type: 'number',
      default: 25,
    })
    .example('mfn procs node --json', 'every node process with pid/cpu/mem')
    .example('mfn procs --json', 'top 25 by cpu — what is this machine doing?');

const handler = async (argv: any) => {
  const top = Number(argv.top);
  if (!Number.isInteger(top) || top < 1 || top > 5000) {
    return fail(argv, 'InvalidTop', '--top must be an integer in 1..5000.', 2);
  }

  let procs: Proc[];
  try {
    procs = isWin ? await winProcs() : await unixProcs();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ListError', `Could not list processes: ${message}`);
  }

  const pattern = argv.pattern !== undefined ? String(argv.pattern).toLowerCase() : null;
  const matched = pattern ? procs.filter((p) => p.command.toLowerCase().includes(pattern)) : procs;
  const processes = matched
    .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0) || (b.memMB ?? 0) - (a.memMB ?? 0))
    .slice(0, top);

  emit(argv, { pattern, total: procs.length, matched: matched.length, processes }, () => {
    for (const p of processes) {
      const cpu = p.cpu === null ? '   -' : `${p.cpu.toFixed(1)}%`.padStart(6);
      console.log(
        `${String(p.pid).padStart(7)}  ${cpu}  ${String(p.memMB ?? '-').padStart(8)}M  ${p.command}`,
      );
    }
  });
};

const procs = { command, describe, builder, handler };

export default procs;
