import chalk from 'chalk';
import { getCurrentUserName } from '../utility';
import { COMMANDS } from '../catalog';
import pkg from '../../package.json';

/** A friendly rotating tip — surfaces a different capability each run. */
const TIPS: readonly string[] = [
  'add --json to any command for clean, machine-readable output',
  'piping a command (no TTY) auto-emits JSON — great for agents & scripts',
  'every command returns a stable exit code: 0 = ok, non-zero = failure',
  'mfn <command> --help shows its flags and copy-paste examples',
  'mfn capabilities --json lists every command an agent can call',
  'mfn kill -p 3000 8080 -y frees stuck ports in one shot',
];

const sep = (color: string) => chalk.hex(color)('─'.repeat(62));

/**
 * The welcome banner — master-cli's signature.
 *
 * Rendered only on an interactive terminal (and never with `--json`), and
 * written to **stderr**, so stdout stays a clean machine-readable channel for
 * agents while humans still get the full experience.
 */
export const logoWelcome = async () => {
  const interactive = Boolean(process.stdout.isTTY) && !process.argv.includes('--json');
  if (!interactive) return;

  // figlet and boxen exist only for this banner. Loading them lazily — after
  // the interactive check — keeps headless/agent invocations from paying their
  // module-load cost on every call.
  const [{ default: figlet }, { default: boxen }] = await Promise.all([
    import('figlet'),
    import('boxen'),
  ]);
  const art = await new Promise<string>((resolve, reject) => {
    figlet('M4N-CLI', (err, data) => (err ? reject(err) : resolve(data ?? '')));
  });
  const box = boxen(chalk.hex('#27A244').bold(art), {
    padding: 1,
    margin: { top: 1, bottom: 0, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: '#C1C110',
    dimBorder: true,
  });

  const user = getCurrentUserName();
  const dot = chalk.dim('  •  ');

  // Identity / environment chips.
  const chips = [
    chalk.hex('#44bcd8').bold(`mfn v${pkg.version}`),
    chalk.gray(`node ${process.version}`),
    chalk.gray(`${process.platform}/${process.arch}`),
    chalk.green.bold('AI-friendly'),
  ].join(dot);

  // Current time — dogfooding @master4n/temporal-transformer (lazy: banner-only).
  let clock = '';
  try {
    const { getEpochNow } = await import('@master4n/temporal-transformer');
    const now = getEpochNow();
    clock = `${now.iso.replace('T', ' ').slice(0, 19)}  ${chalk.dim(`(${now.timezone})`)}`;
  } catch {
    /* clock is optional */
  }

  // 40+ commands would be a wall of text — show category: count, point at
  // `mfn capabilities` for the full list.
  const byCategory = new Map<string, number>();
  for (const c of COMMANDS) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
  const tools =
    [...byCategory.entries()]
      .map(([cat, n]) => `${chalk.cyan(cat)}${chalk.dim(`(${n})`)}`)
      .join(chalk.dim(' · ')) + chalk.dim(`  → mfn capabilities`);
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  const out = (s = '') => console.error(s);
  out(sep('#C1C110'));
  out(box);
  out(
    '  ' +
      (user ? chalk.magenta(`👋 Welcome, ${chalk.bold(user)}`) : chalk.magenta('👋 Welcome')) +
      dot +
      chips,
  );
  if (clock) out('  ' + chalk.gray('🕒 ') + chalk.white(clock));
  out('');
  out('  ' + chalk.yellow.bold('🧰 tools  ') + tools);
  out('  ' + chalk.yellow.bold('💡 tip    ') + chalk.white(tip));
  out('  ' + chalk.yellow.bold('🤖 help   ') + chalk.white('mfn <command> --help'));
  out(sep('#C1C110'));
};
