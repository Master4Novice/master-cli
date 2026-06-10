import { Logger, getCacheDirectory, saveIgnoresToCache, colorQuestions } from '../utility';
import { ProcessInfo } from '../interface';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'os';
import fs from 'fs-extra';
import path from 'path';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';

const logger = Logger();
const run = promisify(execFile);
const PORTS_CACHE = path.join(getCacheDirectory(), 'ports.json');
const isWin = platform() === 'win32';

interface PortsCache {
  ports: number[];
}

async function getPortsFromCache(): Promise<PortsCache> {
  try {
    return await fs.readJson(PORTS_CACHE);
  } catch (error: any) {
    if (error.code === 'ENOENT') return { ports: [] };
    throw error;
  }
}

/**
 * Find the PID listening on a port. Uses execFile (no shell) and filters the
 * output in JS, so a port value can never inject a shell command.
 */
async function getProcessId(port: number): Promise<ProcessInfo | null> {
  try {
    if (isWin) {
      const { stdout } = await run('netstat', ['-ano']);
      const line = stdout.split('\n').find((l) => l.includes(`:${port}`) && /LISTENING/i.test(l));
      const pid = line ? line.trim().split(/\s+/).pop() : null;
      return pid ? { port, pid } : null;
    }
    const { stdout } = await run('lsof', ['-i', `:${port}`]);
    const line = stdout.split('\n').find((l) => /LISTEN/.test(l));
    const pid = line ? line.trim().split(/\s+/)[1] : null;
    return pid ? { port, pid } : null;
  } catch {
    // lsof/netstat exit non-zero when nothing matches → port is free.
    return null;
  }
}

async function killProcessById(pid: string): Promise<void> {
  // The pid comes from parsing lsof/netstat output. execFile already prevents
  // shell injection, but require a strictly numeric pid anyway so a parsing
  // surprise can never become a stray kill argument (e.g. "-1" = all processes).
  if (!/^\d+$/.test(pid)) {
    throw new Error(`Refusing to kill non-numeric PID "${pid}"`);
  }
  // PID 0 signals the whole process group; PID 1 is init/launchd. A parsing
  // surprise must never resolve to either.
  if (Number(pid) <= 1) {
    throw new Error(`Refusing to kill system PID ${pid}`);
  }
  if (isWin) {
    await run('taskkill', ['/PID', pid, '/F']);
  } else {
    await run('kill', ['-9', pid]);
  }
}

const command = 'kill';
const describe = 'Kill the process(es) listening on specific ports';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('ports', {
      alias: 'p',
      describe: 'Port number(s) to free',
      type: 'array',
      // Validation happens in the handler (not coerce): a coerce throw surfaces
      // as CommandError/exit 1, but bad input must be UsageError/exit 2.
    })
    .option('yes', {
      alias: 'y',
      type: 'boolean',
      default: false,
      describe: 'Kill all matching processes without the interactive prompt',
    })
    .example('mfn kill -p 3000 8080 -y --json', 'free ports 3000 and 8080');

const handler = async (argv: any) => {
  const rawPorts = (argv.ports as unknown[]) ?? [];
  let ports: number[] = [];
  for (const p of rawPorts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      return fail(
        argv,
        'InvalidPort',
        `Invalid port number: ${p} (expected an integer in 1..65535).`,
        2,
      );
    }
    ports.push(n);
  }

  if (ports.length === 0) {
    // Cache-replay is a human convenience only. In headless/--json mode an agent
    // must be stateless: require explicit ports rather than silently reusing the
    // last run's ports from ~/.mfn/cache.
    const cached = canPrompt(argv) ? await getPortsFromCache() : { ports: [] };
    if (cached.ports?.length) {
      ports = cached.ports;
      logger.info(`Using cached ports [${ports.join(', ')}]`);
    } else {
      return fail(
        argv,
        'NoPorts',
        'No ports provided. Use -p <port...>. See `mfn kill --help`.',
        2,
      );
    }
  }

  // Persist the requested ports for next time (best-effort).
  await saveIgnoresToCache({ ports }, PORTS_CACHE).catch(() => {});

  const found = (await Promise.all(ports.map(getProcessId))).filter(
    (i): i is ProcessInfo => i !== null,
  );
  const notFound = ports.filter((p) => !found.some((f) => f.port === p));

  if (found.length === 0) {
    return emit(argv, { killed: [], failed: [], notFound }, () =>
      logger.info(`No processes listening on [${ports.join(', ')}]`),
    );
  }

  // Selection: agent/headless or --yes ⇒ kill all; on a TTY, let the user pick.
  let targets = found;
  if (canPrompt(argv) && !argv.yes) {
    // inquirer is TTY-only — lazy import keeps headless invocations fast.
    const { default: inquirer } = await import('inquirer');
    const { pids } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'pids',
        message: colorQuestions('Select the processes to kill:'),
        choices: found.map((i) => ({ name: `Port ${i.port} → PID ${i.pid}`, value: i.pid })),
      },
    ]);
    targets = found.filter((i) => pids.includes(i.pid));
  }

  const killed: ProcessInfo[] = [];
  const failed: { port: number; pid: string; error: string }[] = [];
  for (const t of targets) {
    try {
      await killProcessById(t.pid);
      killed.push(t);
    } catch (error) {
      failed.push({ ...t, error: error instanceof Error ? error.message : String(error) });
    }
  }

  emit(argv, { killed, failed, notFound }, () => {
    for (const k of killed) logger.info(`Killed PID ${k.pid} on port ${k.port}`);
    for (const f of failed)
      logger.error(`Failed to kill PID ${f.pid} (port ${f.port}): ${f.error}`);
    if (notFound.length) logger.warn(`No process on [${notFound.join(', ')}]`);
  });

  if (failed.length > 0) process.exit(1);
};

const killProcess = { command, describe, builder, handler };

export default killProcess;
