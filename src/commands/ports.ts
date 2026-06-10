import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const isWin = platform() === 'win32';

interface Listener {
  port: number;
  pid: number;
  command: string | null;
  address: string;
}

/** Unix: lsof structured output. execFile (no shell), output parsed in JS. */
async function unixListeners(): Promise<Listener[]> {
  const { stdout } = await run('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], {
    timeout: 10_000,
  });
  const out: Listener[] = [];
  for (const line of stdout.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 9) continue;
    const name = cols[cols.length - 2].includes(':') ? cols[cols.length - 2] : cols[8];
    const m = /^(.*):(\d+)$/.exec(name);
    if (!m) continue;
    out.push({
      port: Number(m[2]),
      pid: Number(cols[1]),
      command: cols[0],
      address: m[1],
    });
  }
  return out;
}

/** Windows: netstat -ano, LISTENING rows only. */
async function winListeners(): Promise<Listener[]> {
  const { stdout } = await run('netstat', ['-ano'], { timeout: 10_000 });
  const out: Listener[] = [];
  for (const line of stdout.split('\n')) {
    if (!/LISTENING/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    const m = /^(.*):(\d+)$/.exec(cols[1] ?? '');
    if (!m) continue;
    out.push({
      port: Number(m[2]),
      pid: Number(cols[cols.length - 1]),
      command: null,
      address: m[1],
    });
  }
  return out;
}

const command = 'ports';
const describe = 'List ALL listening TCP ports with their owning processes';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('min', { describe: 'Only ports >= this value', type: 'number', default: 1 })
    .example('mfn ports --json', 'every listener — which dev servers are running?')
    .example('mfn ports --min 3000 --json', 'just the app-range ports');

const handler = async (argv: any) => {
  const min = Number(argv.min);
  if (!Number.isInteger(min) || min < 1 || min > 65535) {
    return fail(argv, 'InvalidMin', '--min must be an integer in 1..65535.', 2);
  }

  let raw: Listener[];
  try {
    raw = isWin ? await winListeners() : await unixListeners();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ListError', `Could not list listeners: ${message}`);
  }

  // Dedupe (same pid listening on v4+v6 shows twice) and sort by port.
  const seen = new Map<string, Listener>();
  for (const l of raw) {
    if (l.port < min) continue;
    const key = `${l.port}:${l.pid}`;
    if (!seen.has(key)) seen.set(key, l);
  }
  const listeners = [...seen.values()].sort((a, b) => a.port - b.port);

  emit(argv, { count: listeners.length, listeners }, () => {
    for (const l of listeners) {
      console.log(
        `${String(l.port).padStart(6)}  pid ${String(l.pid).padEnd(8)} ${l.command ?? ''}`,
      );
    }
  });
};

const ports = { command, describe, builder, handler };

export default ports;
