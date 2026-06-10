import instance from './instance';
import {
  cts,
  sc,
  deco,
  date,
  epoch,
  killProcess,
  update,
  capabilities,
  id,
  hash,
  encode,
  random,
  port,
  jsonCmd,
  count,
  lines,
  have,
  sys,
  repo,
  calc,
  semver,
  caseCmd,
  cron,
  diff,
  env,
  size,
  ext,
  freq,
  regex,
  url,
  ip,
  escapeCmd,
  schema,
  outlineCmd,
  imports,
  replace,
  recent,
  pkgCmd,
  dotenv,
  wait,
  ports,
  http,
  base,
} from './commands';
import { CommandBuilder } from './utility';
import { failEnvelope } from './utility/io';
import type { CliCommand } from './interface';
import pkg from '../package.json';

const add = (c: CliCommand) =>
  CommandBuilder(instance).add(c.command, c.describe, c.builder, c.handler);

/**Discovery */
add(capabilities);
/**Generators & codecs (zero-dependency primitives) */
add(id);
add(hash);
add(encode);
add(random);
/**Time */
add(epoch);
add(date);
add(deco);
/**Text & data extraction (token savers) */
add(jsonCmd);
add(schema);
add(count);
add(lines);
add(diff);
add(freq);
add(caseCmd);
add(escapeCmd);
/**Exact computation (hallucination killers) */
add(calc);
add(semver);
add(cron);
add(regex);
add(url);
/**Code intelligence */
add(outlineCmd);
add(imports);
add(replace);
add(recent);
add(pkgCmd);
add(dotenv);
add(base);
/**OS / filesystem / network */
add(port);
add(ports);
add(killProcess);
add(wait);
add(http);
add(sc);
add(cts);
add(have);
add(sys);
add(repo);
add(env);
add(size);
add(ext);
add(ip);
/**Maintenance */
add(update);

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
