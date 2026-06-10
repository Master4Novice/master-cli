import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * Env vars whose VALUES must never reach stdout un-redacted — agents paste
 * command output into context, logs, and PRs. Redaction is the default and
 * there is deliberately NO flag to turn it off.
 */
const SECRET_PATTERN =
  /(key|token|secret|password|passwd|credential|auth|cookie|session|private|api)/i;

const redact = (value: string): string =>
  value.length <= 8
    ? '••••'
    : `${value.slice(0, 3)}…${value.slice(-2)} (${value.length} chars, redacted)`;

const looksSecret = (name: string): boolean => SECRET_PATTERN.test(name);

const command = 'env [names...]';
const describe = 'Inspect environment variables with automatic secret redaction';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('names', {
      describe: 'Variable names to read (omit to list all names)',
      type: 'string',
    })
    .option('prefix', {
      alias: 'p',
      describe: 'Only variables starting with this prefix',
      type: 'string',
    })
    .example('mfn env NODE_ENV PATH --json', 'specific variables (secrets auto-redacted)')
    .example('mfn env -p NEXT_PUBLIC_ --json', 'all NEXT_PUBLIC_* variables')
    .example('mfn env --json', 'just the names — values omitted');

const handler = (argv: any) => {
  const names = ((argv.names as string[]) ?? []).map(String);
  const prefix = argv.prefix !== undefined ? String(argv.prefix) : null;

  if (names.length > 0) {
    const vars = names.map((name) => {
      const raw = process.env[name];
      if (raw === undefined) return { name, set: false, value: null, redacted: false };
      const secret = looksSecret(name);
      return { name, set: true, value: secret ? redact(raw) : raw, redacted: secret };
    });
    const missing = vars.filter((v) => !v.set).map((v) => v.name);
    return emit(argv, { count: vars.length, missing, vars }, () => {
      for (const v of vars) console.log(v.set ? `${v.name}=${v.value}` : `${v.name} (not set)`);
    });
  }

  // No names: list names only (never dump every value into an agent's context).
  const all = Object.keys(process.env)
    .filter((n) => (prefix ? n.startsWith(prefix) : true))
    .sort();
  if (prefix) {
    const vars = all.map((name) => {
      const secret = looksSecret(name);
      const raw = process.env[name] ?? '';
      return { name, set: true, value: secret ? redact(raw) : raw, redacted: secret };
    });
    return emit(argv, { prefix, count: vars.length, vars }, () => {
      for (const v of vars) console.log(`${v.name}=${v.value}`);
    });
  }
  if (all.length === 0) return fail(argv, 'NoMatch', 'No environment variables found.');
  emit(argv, { count: all.length, names: all }, () => all.forEach((n) => console.log(n)));
};

const env = { command, describe, builder, handler };

export default env;
