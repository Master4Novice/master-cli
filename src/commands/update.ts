import chalk from 'chalk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from '../utility';
import { withJsonFlag, canPrompt, emit, fail } from '../utility/io';

const logger = Logger();
const run = promisify(execFile);

// execFile (no shell): a crafted package name can't inject commands the way
// `exec(`npm install -g ${pkg}`)` allowed (e.g. "x && rm -rf ~").
async function npmInstallGlobal(pkg: string): Promise<void> {
  await run('npm', ['install', '-g', pkg]);
}

async function npmVersion(pkg: string): Promise<string | null> {
  try {
    const { stdout } = await run('npm', ['view', pkg, 'version']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

const command = 'update [package]';
const describe = 'Update the CLI or a specified package to the latest version';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('package', {
      describe: 'npm package to update globally (default: this CLI)',
      type: 'string',
      default: '@master4n/master-cli',
    })
    .example('mfn update', 'update master-cli itself to the latest version')
    .example('mfn update typescript --json', 'update a specific global package');

const handler = async (argv: any) => {
  const pkg = String(argv.package ?? '@master4n/master-cli');
  // ora is TTY-only eye candy — lazy import keeps headless invocations fast.
  const spinner = canPrompt(argv) ? (await import('ora')).default() : null;
  const startedAt = Date.now();

  spinner?.start(chalk.green(`updating/installing ${pkg}`));
  try {
    await npmInstallGlobal(pkg);
    const version = await npmVersion(pkg);
    const durationMs = Date.now() - startedAt;
    spinner?.succeed(
      `${chalk.green(`updated ${pkg}`)} ${chalk.dim(`(${(durationMs / 1000).toFixed(3)}s)`)}`,
    );
    emit(argv, { package: pkg, version, durationMs }, () => {
      logger.info(`${pkg} updated/installed${version ? ` -> ${chalk.green(version)}` : ''}`);
    });
  } catch (error) {
    spinner?.fail(chalk.red(`failed updating ${pkg}`));
    const message = error instanceof Error ? error.message : String(error);
    fail(argv, 'UpdateFailed', `Failed to update "${pkg}": ${message}`);
  }
};

const update = {
  command,
  describe,
  builder,
  handler,
};

export default update;
