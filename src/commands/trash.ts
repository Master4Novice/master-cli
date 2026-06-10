import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform, homedir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const os = platform();

/** A destination name that doesn't collide with anything already in the trash. */
function uniqueName(dir: string, name: string): string {
  if (!fs.existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i++) {
    const candidate = `${stem} ${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
}

/** macOS: move into ~/.Trash (no "Put Back" metadata, but fully recoverable). */
function trashDarwin(abs: string): string {
  const dir = path.join(homedir(), '.Trash');
  const dest = path.join(dir, uniqueName(dir, path.basename(abs)));
  fs.renameSync(abs, dest);
  return dest;
}

/** Linux: freedesktop.org trash spec — files/ entry + info/ .trashinfo. */
function trashLinux(abs: string): string {
  const base = path.join(homedir(), '.local', 'share', 'Trash');
  fs.mkdirSync(path.join(base, 'files'), { recursive: true });
  fs.mkdirSync(path.join(base, 'info'), { recursive: true });
  const name = uniqueName(path.join(base, 'files'), path.basename(abs));
  const stamp = new Date().toISOString().slice(0, 19);
  fs.writeFileSync(
    path.join(base, 'info', `${name}.trashinfo`),
    `[Trash Info]\nPath=${encodeURI(abs)}\nDeletionDate=${stamp}\n`,
  );
  const dest = path.join(base, 'files', name);
  fs.renameSync(abs, dest);
  return dest;
}

/** Windows: real Recycle Bin via the VisualBasic FileSystem API. */
async function trashWindows(abs: string): Promise<string> {
  const script =
    'Add-Type -AssemblyName Microsoft.VisualBasic;' +
    'if (Test-Path -LiteralPath $args[0] -PathType Container) {' +
    '[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($args[0],"OnlyErrorDialogs","SendToRecycleBin")' +
    '} else {' +
    '[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($args[0],"OnlyErrorDialogs","SendToRecycleBin")}';
  await run('powershell', ['-NoProfile', '-Command', script, abs], { timeout: 15_000 });
  return 'Recycle Bin';
}

const command = 'trash <paths...>';
const describe = 'Move files/dirs to the OS trash — reversible, never rm -rf';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('paths', { describe: 'Files or directories to trash', type: 'string' })
    .example('mfn trash build-old.log --json', 'recoverable delete')
    .example('mfn trash dist coverage --json', 'trash multiple paths in one call');

const handler = async (argv: any) => {
  const paths = (argv.paths as string[]).map(String);
  const trashed: { path: string; movedTo: string }[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const p of paths) {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) {
      failed.push({ path: abs, error: 'does not exist' });
      continue;
    }
    // Guard the obvious catastrophes: never trash /, the home dir, the cwd, or
    // any ancestor of the cwd. Compare REALPATHS — on macOS /var vs /private/var
    // symlinks make string equality miss (found by the test suite).
    let real: string;
    let realCwd: string;
    let realHome: string;
    try {
      real = fs.realpathSync(abs);
      realCwd = fs.realpathSync(process.cwd());
      realHome = fs.realpathSync(homedir());
    } catch {
      real = abs;
      realCwd = process.cwd();
      realHome = homedir();
    }
    if (
      real === path.parse(real).root ||
      real === realHome ||
      real === realCwd ||
      realCwd.startsWith(real + path.sep)
    ) {
      failed.push({ path: abs, error: 'refusing to trash root/home/cwd (or a parent of cwd)' });
      continue;
    }
    try {
      const movedTo =
        os === 'darwin'
          ? trashDarwin(abs)
          : os === 'win32'
            ? await trashWindows(abs)
            : trashLinux(abs);
      trashed.push({ path: abs, movedTo });
    } catch (error) {
      failed.push({ path: abs, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (trashed.length === 0 && failed.length > 0) {
    return fail(argv, 'TrashFailed', failed.map((f) => `${f.path}: ${f.error}`).join('; '));
  }
  emit(argv, { trashed, failed, count: trashed.length }, () => {
    for (const t of trashed) console.log(`trashed ${t.path}`);
    for (const f of failed) console.error(`failed  ${f.path}: ${f.error}`);
  });
  if (failed.length > 0) process.exit(1);
};

const trash = { command, describe, builder, handler };

export default trash;
