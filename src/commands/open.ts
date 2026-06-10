import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const os = platform();

/**
 * Open a file or URL in the user's default application/browser. The target is
 * validated first: it must be an http(s) URL or an existing file/directory —
 * never an arbitrary string handed to the OS opener.
 */
async function openTarget(target: string): Promise<string> {
  if (os === 'darwin') {
    await run('open', [target], { timeout: 10_000 });
    return 'open';
  }
  if (os === 'win32') {
    // rundll32's URL handler takes the target as a plain argv entry — unlike
    // `cmd /c start`, nothing re-parses metacharacters.
    await run('rundll32', ['url.dll,FileProtocolHandler', target], { timeout: 10_000 });
    return 'rundll32';
  }
  await run('xdg-open', [target], { timeout: 10_000 });
  return 'xdg-open';
}

const command = 'open <target>';
const describe = 'Open a file or URL in the default app/browser (validated first)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('target', {
      describe: 'http(s) URL, or an existing file/directory',
      type: 'string',
    })
    .example('mfn open https://github.com/Master4Novice/master-cli --json', 'show the user a page')
    .example('mfn open coverage/index.html --json', 'open a report you just generated');

const handler = async (argv: any) => {
  const raw = String(argv.target);

  let kind: 'url' | 'file';
  let resolved = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      new URL(raw);
    } catch {
      return fail(argv, 'InvalidURL', `"${raw}" is not a valid URL.`, 2);
    }
    kind = 'url';
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    // Refuse non-http schemes (file:, javascript:, custom handlers) — too easy
    // to turn "open" into something else entirely.
    return fail(argv, 'UnsupportedScheme', 'Only http(s) URLs or local paths are allowed.', 2);
  } else {
    resolved = path.resolve(raw);
    if (!existsSync(resolved)) {
      return fail(argv, 'NotFound', `No such file or directory: ${resolved}`, 2);
    }
    kind = 'file';
  }

  try {
    const opener = await openTarget(resolved);
    emit(argv, { opened: true, kind, target: resolved, opener }, () =>
      console.log(`opened ${resolved}`),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'OpenFailed', `Could not open ${resolved}: ${message}`);
  }
};

const openCmd = { command, describe, builder, handler };

export default openCmd;
