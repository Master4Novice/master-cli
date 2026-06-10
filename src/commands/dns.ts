import {
  lookup,
  resolve4,
  resolve6,
  resolveMx,
  resolveTxt,
  resolveCname,
  resolveNs,
} from 'node:dns/promises';
import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * DNS facts via Node's resolver — no dig/nslookup parsing, works identically
 * on every OS. `lookup` uses the system resolver (what connections actually
 * use); record queries go to the configured DNS servers.
 */
const settle = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

const command = 'dns <hostname>';
const describe = 'Resolve a hostname: A/AAAA/CNAME/MX/TXT/NS in one call (no dig parsing)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('hostname', { describe: 'Hostname to resolve', type: 'string' })
    .option('type', {
      alias: 't',
      describe: 'Single record type instead of the full sweep',
      type: 'string',
      choices: ['a', 'aaaa', 'cname', 'mx', 'txt', 'ns'],
    })
    .example('mfn dns github.com --json', 'all common records at once')
    .example('mfn dns example.com -t mx --json', 'just the MX records');

const handler = async (argv: any) => {
  const hostname = String(argv.hostname).trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(hostname)) {
    return fail(argv, 'InvalidHostname', `"${argv.hostname}" is not a valid hostname.`, 2);
  }

  if (argv.type) {
    const type = String(argv.type);
    const fns: Record<string, () => Promise<unknown>> = {
      a: () => resolve4(hostname),
      aaaa: () => resolve6(hostname),
      cname: () => resolveCname(hostname),
      mx: () => resolveMx(hostname),
      txt: () => resolveTxt(hostname),
      ns: () => resolveNs(hostname),
    };
    try {
      const records = await fns[type]();
      return emit(argv, { hostname, type, records }, () =>
        console.log(JSON.stringify(records, null, 2)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        argv,
        'ResolveFailed',
        `${type.toUpperCase()} lookup for ${hostname}: ${message}`,
      );
    }
  }

  // Full sweep — missing record types are null, not errors.
  const [system, a, aaaa, cname, mx, txt, ns] = await Promise.all([
    settle(lookup(hostname)),
    settle(resolve4(hostname)),
    settle(resolve6(hostname)),
    settle(resolveCname(hostname)),
    settle(resolveMx(hostname)),
    settle(resolveTxt(hostname)),
    settle(resolveNs(hostname)),
  ]);
  if (!system && !a && !aaaa && !cname) {
    return fail(argv, 'ResolveFailed', `${hostname} did not resolve (no A/AAAA/CNAME).`);
  }
  emit(
    argv,
    {
      hostname,
      resolved: system ? { address: system.address, family: `IPv${system.family}` } : null,
      a,
      aaaa,
      cname,
      mx,
      txt: txt ? txt.map((parts) => parts.join('')) : null,
      ns,
    },
    () => {
      if (system) console.log(`${hostname} → ${system.address}`);
      if (a) console.log(`A     ${a.join(', ')}`);
      if (aaaa) console.log(`AAAA  ${aaaa.join(', ')}`);
      if (mx) console.log(`MX    ${mx.map((m) => `${m.priority} ${m.exchange}`).join(', ')}`);
      if (ns) console.log(`NS    ${ns.join(', ')}`);
    },
  );
};

const dns = { command, describe, builder, handler };

export default dns;
