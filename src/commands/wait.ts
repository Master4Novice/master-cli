import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { withJsonFlag, emit, fail } from '../utility/io';
import { isBlockedUrl, blockedUrlMessage } from '../utility/guard';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function portReady(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host });
    sock.setTimeout(1000);
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}

async function urlReady(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

const command = 'wait';
const describe = 'Block until a port, file, or URL is ready (or timeout) — replaces sleep loops';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('port', { alias: 'p', describe: 'TCP port to wait for (on 127.0.0.1)', type: 'number' })
    .option('url', { alias: 'u', describe: 'Wait until this URL responds 2xx/3xx', type: 'string' })
    .option('file', { alias: 'f', describe: 'Wait until this file exists', type: 'string' })
    .option('timeout', { alias: 't', describe: 'Max seconds to wait', type: 'number', default: 30 })
    .option('interval', { describe: 'Poll interval in ms', type: 'number', default: 250 })
    .example('mfn wait -p 3000 -t 30 --json', 'dev server is accepting connections')
    .example('mfn wait -u http://localhost:3000/health --json', 'health endpoint is green')
    .example('mfn wait -f dist/bin/index.js --json', 'build artifact exists');

const handler = async (argv: any) => {
  const targets = [argv.port, argv.url, argv.file].filter((x) => x !== undefined);
  if (targets.length !== 1) {
    return fail(argv, 'InvalidTarget', 'Provide exactly one of --port, --url, or --file.', 2);
  }
  const timeout = Number(argv.timeout);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 600) {
    return fail(argv, 'InvalidTimeout', '--timeout must be 1..600 seconds.', 2);
  }
  const interval = Number(argv.interval);
  if (!Number.isInteger(interval) || interval < 50 || interval > 10_000) {
    return fail(argv, 'InvalidInterval', '--interval must be 50..10000 ms.', 2);
  }

  let target: string;
  let check: () => Promise<boolean>;
  if (argv.port !== undefined) {
    const port = Number(argv.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return fail(argv, 'InvalidPort', '--port must be an integer in 1..65535.', 2);
    }
    target = `port:${port}`;
    check = () => portReady(port);
  } else if (argv.url !== undefined) {
    const url = String(argv.url);
    if (!/^https?:\/\//.test(url)) {
      return fail(argv, 'InvalidURL', '--url must start with http:// or https://.', 2);
    }
    try {
      if (isBlockedUrl(new URL(url))) {
        return fail(argv, 'BlockedTarget', blockedUrlMessage(url), 2);
      }
    } catch {
      return fail(argv, 'InvalidURL', `"${url}" is not a valid URL.`, 2);
    }
    target = `url:${url}`;
    check = () => urlReady(url);
  } else {
    const file = String(argv.file);
    target = `file:${file}`;
    check = async () => existsSync(file);
  }

  const startedAt = Date.now();
  const deadline = startedAt + timeout * 1000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    if (await check()) {
      const waitedMs = Date.now() - startedAt;
      return emit(argv, { target, ready: true, waitedMs, attempts }, () =>
        console.log(`${target} ready after ${waitedMs}ms (${attempts} checks)`),
      );
    }
    await sleep(interval);
  }
  fail(argv, 'Timeout', `${target} was not ready within ${timeout}s (${attempts} checks).`);
};

const wait = { command, describe, builder, handler };

export default wait;
