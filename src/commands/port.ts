import { createServer } from 'node:net';
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

/** True if `port` can be bound right now (i.e. it's free). */
function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', () => resolve(false));
    srv.listen(port, () => srv.close(() => resolve(true)));
  });
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

  emit(argv, count === 1 ? { port: ports[0] } : { count, ports }, () =>
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
