import { createServer, createConnection } from 'node:net';
import { withJsonFlag, emit, fail } from '../utility/io';

/** Resolve to a free port (0 lets the OS pick an available ephemeral port). */
function findFreePort(preferred = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(preferred, () => {
      const addr = srv.address();
      const p = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(p));
    });
  });
}

/**
 * Is something listening on `port` at `host`? Connect-probe: a successful TCP
 * connect means a listener accepted us; ECONNREFUSED means nothing is there.
 *
 * Connect-probing (rather than bind-probing) is what makes this correct: on
 * macOS/BSD you can bind the wildcard `0.0.0.0` even while `127.0.0.1:port` is
 * held, so a bind test misses address-specific listeners. A connect reaches the
 * listener however it bound.
 */
function listening(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host });
    sock.setTimeout(500);
    const done = (result: boolean) => {
      sock.destroy();
      resolve(result);
    };
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false)); // ECONNREFUSED → free
  });
}

/**
 * True if `port` is free on loopback for both IPv4 and IPv6 — i.e. nothing is
 * listening reachably via 127.0.0.1 or ::1. This catches servers bound to
 * `0.0.0.0`, `127.0.0.1`, `::`, or `::1` (the realistic local cases); a server
 * bound only to a specific non-loopback interface is out of scope.
 */
async function isFree(port: number): Promise<boolean> {
  const [v4, v6] = await Promise.all([
    listening(port, '127.0.0.1'),
    listening(port, '::1'),
  ]);
  return !v4 && !v6;
}

const command = 'port';
const describe = 'Find a free port, or check whether a specific port is available';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('check', { alias: 'c', describe: 'Check if this specific port is free', type: 'number' })
    .option('count', { alias: 'n', describe: 'Return this many distinct free ports', type: 'number', default: 1 })
    .example('mfn port --json', 'one free port')
    .example('mfn port -n 3 --json', 'three free ports')
    .example('mfn port -c 3000 --json', 'is port 3000 free?');

const handler = async (argv: any) => {
  // Check mode: report availability of a specific port.
  if (argv.check !== undefined) {
    const port = Number(argv.check);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return fail(argv, 'InvalidPort', '--check must be an integer in 1..65535.', 2);
    }
    const available = await isFree(port);
    return emit(argv, { port, available }, () =>
      console.log(`${port} is ${available ? 'free' : 'in use'}`),
    );
  }

  const count = Number(argv.count);
  if (!Number.isInteger(count) || count < 1) {
    return fail(argv, 'InvalidCount', '--count must be a positive integer.', 2);
  }

  // Collect distinct free ports. Hold each open until all are chosen so the OS
  // doesn't hand back the same ephemeral port twice.
  const held: Array<{ port: number; close: () => void }> = [];
  try {
    while (held.length < count) {
      const port = await findFreePortHeld();
      held.push(port);
    }
  } catch (error) {
    held.forEach((h) => h.close());
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'PortError', `Could not allocate a free port: ${message}`);
  }
  const ports = held.map((h) => h.port);
  held.forEach((h) => h.close());

  // Stable shape regardless of count: always { count, ports }, plus `port` as a
  // convenience alias for the first — so an agent requesting N=1 sees the same
  // keys as N>1.
  emit(argv, { count, ports, port: ports[0] }, () =>
    ports.forEach((p) => console.log(p)),
  );
};

/** Open a listener on an OS-chosen free port and keep it open (caller closes). */
function findFreePortHeld(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ port, close: () => srv.close() });
    });
  });
}

// Exported for completeness/testing of the simple single-shot finder.
export { findFreePort };

const port = { command, describe, builder, handler };

export default port;
