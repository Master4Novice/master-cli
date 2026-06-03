import { COMMANDS } from '../catalog';
import pkg from '../../package.json';
import { withJsonFlag, emit } from '../utility/io';

const command = 'capabilities';
const describe = 'List every command an agent can call (self-describing manifest)';

const builder = (yargs: any) =>
  withJsonFlag(yargs).example('mfn capabilities --json', 'machine-readable manifest');

const handler = (argv: any) => {
  emit(
    argv,
    {
      name: pkg.name,
      version: pkg.version,
      bin: 'mfn',
      conventions: {
        json: 'pass --json, or pipe (non-TTY auto-emits) — one {ok,...} object on stdout',
        exitCodes: { ok: 0, error: 1, usage: 2 },
        logs: 'banners and logs go to stderr; stdout carries data only',
      },
      commands: COMMANDS.map((c) => ({
        name: c.name,
        summary: c.summary,
        examples: c.examples,
      })),
    },
    () => {
      console.log(`${pkg.name} v${pkg.version}  (bin: mfn)`);
      console.log('Commands an agent can call headlessly:');
      for (const c of COMMANDS) {
        console.log(`  ${c.name.padEnd(10)} ${c.summary}`);
      }
      console.log('\nConventions: --json for machine output · exit 0/1/2 · logs on stderr');
    },
  );
};

const capabilities = { command, describe, builder, handler };

export default capabilities;
