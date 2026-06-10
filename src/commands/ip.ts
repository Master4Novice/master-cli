import os from 'node:os';
import { withJsonFlag, emit } from '../utility/io';

const command = 'ip';
const describe = 'Local network interfaces and addresses (no network calls, no ifconfig parsing)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('all', {
      alias: 'a',
      describe: 'Include internal/loopback interfaces',
      type: 'boolean',
      default: false,
    })
    .example('mfn ip --json', 'external-facing local addresses')
    .example('mfn ip -a --json', 'every interface including loopback');

const handler = (argv: any) => {
  const raw = os.networkInterfaces();
  const interfaces = Object.entries(raw)
    .map(([name, addrs]) => ({
      name,
      addresses: (addrs ?? [])
        .filter((a) => argv.all || !a.internal)
        .map((a) => ({
          address: a.address,
          family: a.family,
          internal: a.internal,
          mac: a.mac,
          cidr: a.cidr,
        })),
    }))
    .filter((i) => i.addresses.length > 0);

  // Convenience: the address most tools mean by "my local IP".
  const primaryV4 =
    interfaces.flatMap((i) => i.addresses).find((a) => a.family === 'IPv4' && !a.internal)
      ?.address ?? null;

  emit(argv, { primaryIPv4: primaryV4, count: interfaces.length, interfaces }, () => {
    if (primaryV4) console.log(`primary IPv4: ${primaryV4}`);
    for (const i of interfaces) {
      for (const a of i.addresses)
        console.log(`${i.name.padEnd(10)} ${a.family.padEnd(5)} ${a.address}`);
    }
  });
};

const ip = { command, describe, builder, handler };

export default ip;
