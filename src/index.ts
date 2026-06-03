import instance from './instance';
import { cts, sc, deco, date, epoch, killProcess, update, capabilities } from './commands';
import { CommandBuilder } from './utility';
import { failEnvelope } from './utility/io';
import pkg from '../package.json';

/**Discovery */
CommandBuilder(instance).add(capabilities.command, capabilities.describe, capabilities.builder, capabilities.handler);
/**Add commands */
CommandBuilder(instance).add(update.command, update.describe, update.builder, update.handler);
CommandBuilder(instance).add(epoch.command, epoch.describe, epoch.builder, epoch.handler);
CommandBuilder(instance).add(date.command, date.describe, date.builder, date.handler);
CommandBuilder(instance).add(deco.command, deco.describe, deco.builder, deco.handler);
/**OS specific commands */
CommandBuilder(instance).add(sc.command, sc.describe, sc.builder, sc.handler);
CommandBuilder(instance).add(killProcess.command, killProcess.describe, killProcess.builder, killProcess.handler);
CommandBuilder(instance).add(cts.command, cts.describe, cts.builder, cts.handler);


instance
  .usage(
    'mfn <command> [options]\n\n' +
      'Master CLI for developers and AI agents — headless, JSON-first commands that\n' +
      'replace boilerplate agents regenerate on every machine. Every command supports\n' +
      '--json (machine output) and -h/--help (this text).',
  )
  // Pass the version explicitly — yargs' default `.version()` can't resolve it
  // from the rollup-bundled entry (no co-located package.json at runtime), which
  // made `mfn --version` print "unknown".
  .version(pkg.version)
  .alias('version', 'v')
  .help()
  .alias('help', 'h')
  .epilogue(
    'Discover every command (machine-readable): mfn capabilities --json\n' +
      'Agent contract & examples: see llms.txt in this package.\n' +
      'Docs: https://github.com/Master4Novice/master-cli#readme',
  )
  .wrap(null)
  // Reject unknown commands AND unknown flags, and require a command — so typos
  // and stray flags surface instead of silently "succeeding" (exit 0).
  .strict()
  .demandCommand(1, 'No command given. Run `mfn capabilities` to list commands.')
  // Route EVERY parser-layer error (missing required option, unknown
  // command/flag, coerce throw, demandCommand) through the same machine-readable
  // contract the commands use: {ok:false,error,message} on stdout in JSON mode,
  // exit 2 (usage). Without this, yargs prints help to stderr with exit 1 and no
  // JSON — breaking agents that trust the documented contract.
  .fail((msg: string, err: Error | undefined) => {
    // A handler that threw (err set) is a runtime failure (exit 1); a parser
    // problem (msg set) is a usage error (exit 2).
    if (err) failEnvelope('CommandError', err.message || String(err), 1);
    failEnvelope('UsageError', msg || 'Invalid command invocation.', 2);
  })
  .parse();
