import chalk from 'chalk';
import os from 'node:os';
import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import { execFileSync } from 'node:child_process';

// Zero-dependency timestamp (was moment). Stderr is the right sink for logs so
// that stdout stays clean for machine-readable (--json) command output.
const stamp = () => new Date().toISOString();

export function Logger() {
  return {
    info: (info: string) =>
      console.error(
        `${chalk.blue('INFO')} [${chalk.magenta(stamp())}] ${chalk.white(info)}`,
      ),
    warn: (warn: string) =>
      console.error(
        `${chalk.yellow('WARN')} [${chalk.magenta(stamp())}] ${chalk.white(warn)}`,
      ),
    error: (error: string) =>
      console.error(
        `${chalk.red('ERROR')} [${chalk.magenta(stamp())}] ${chalk.white(error)}`,
      ),
    debug: (debug: string) =>
      console.error(
        `${chalk.cyan('DEBUG')} [${chalk.magenta(stamp())}] ${chalk.white(debug)}`,
      ),
  };
}

export function CommandBuilder(instance: any) {
  return {
    add: (
      alias: string,
      describe: string,
      builder: object,
      handler: (argv: any) => any,
    ) => {
      instance.command({
        command: alias,
        describe: describe,
        builder: builder,
        handler: handler,
      });
    },
  };
}

/**
 * Get the current user's name based on the operating system.
 */
export function getCurrentUserName() {
  const platform = os.platform();
  if (platform === 'win32') {
    return process.env['USERNAME'] || 'User';
  } else if (platform === 'darwin' || platform === 'linux') {
    return process.env['USER'] || 'User';
  }
  return '';
}

/**
 * Create the hidden cache directory (`~/.mfn/cache`) if it doesn't exist.
 */
export function createHiddenCacheDirectory() {
  const homeDir = os.homedir();
  const cacheDir = path.join(homeDir, '.mfn', 'cache');
  if (!fs.existsSync(cacheDir)) {
    try {
      if (!fs.existsSync(path.join(homeDir, '.mfn'))) {
        fs.mkdirSync(path.join(homeDir, '.mfn'));
      }
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch {
      /* best-effort; cache is optional */
    }
  }
}

/**
 * Get the location of the cache directory (`~/.mfn/cache`).
 */
export function getCacheDirectory() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.mfn', 'cache');
}

/**
 * Validate argument(s) of type number within the range 1 to 1000.
 * @returns true if every argument is a valid in-range number.
 */
export function validateNumberArguments(...args: number[]): boolean {
  for (const arg of args) {
    if (isNaN(arg) || arg < 1 || arg > 1000) {
      return false;
    }
  }
  return true;
}

export function getLatestVersion(packageName: string) {
  // execFile (no shell) so a crafted package name can't inject shell commands,
  // e.g. `mfn update "x; rm -rf ~"`.
  return execFileSync('npm', ['show', packageName, 'version']).toString().trim();
}

export const colorQuestions = (message: string) => chalk.green(message);

export async function saveIgnoresToCache(
  ignore: any,
  cachePath: any,
): Promise<void> {
  await fsExtra.writeJson(cachePath, ignore, { spaces: 2 });
}
