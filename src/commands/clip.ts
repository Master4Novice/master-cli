import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

/**
 * System clipboard, cross-platform, no shell. Read returns the text; write
 * pipes via stdin so content never touches a command line (no length limits,
 * no quoting hazards, nothing in `ps` output).
 */
const os = platform();
const MAX_WRITE = 1_000_000;

function runWithInput(cmd: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      { timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}

async function readClipboard(): Promise<string> {
  if (os === 'darwin') return runWithInput('pbpaste', []);
  if (os === 'win32')
    return runWithInput('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw']);
  // Linux: X11 first, then Wayland.
  try {
    return await runWithInput('xclip', ['-selection', 'clipboard', '-o']);
  } catch {
    return runWithInput('wl-paste', ['--no-newline']);
  }
}

async function writeClipboard(text: string): Promise<void> {
  if (os === 'darwin') {
    await runWithInput('pbcopy', [], text);
  } else if (os === 'win32') {
    await runWithInput('clip.exe', [], text);
  } else {
    try {
      await runWithInput('xclip', ['-selection', 'clipboard'], text);
    } catch {
      await runWithInput('wl-copy', [], text);
    }
  }
}

const command = 'clip [text]';
const describe = 'Read or write the system clipboard (macOS/Windows/Linux)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', { describe: 'Text to copy (or pipe stdin); omit to read', type: 'string' })
    .option('read', {
      alias: 'r',
      describe: 'Force read mode even when stdin is piped',
      type: 'boolean',
      default: false,
    })
    .example('mfn clip --json', 'read the clipboard')
    .example('mfn clip "deploy done" --json', 'copy text to the clipboard')
    .example('git diff | mfn clip --json', 'copy a diff for the user to paste');

const handler = async (argv: any) => {
  let toWrite: string | undefined;
  if (!argv.read) {
    if (argv.text !== undefined) toWrite = String(argv.text);
    else {
      const piped = await readStdin();
      if (piped) toWrite = piped;
    }
  }

  try {
    if (toWrite !== undefined) {
      if (toWrite.length > MAX_WRITE) {
        return fail(argv, 'InputTooLarge', `Clipboard writes are capped at ${MAX_WRITE} chars.`, 2);
      }
      await writeClipboard(toWrite);
      return emit(argv, { action: 'write', chars: toWrite.length }, () =>
        console.log(`copied ${toWrite!.length} chars`),
      );
    }
    const text = await readClipboard();
    emit(argv, { action: 'read', chars: text.length, text }, () => console.log(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(
      argv,
      'ClipboardUnavailable',
      `Clipboard tool failed (headless session? missing xclip/wl-clipboard?): ${message}`,
    );
  }
};

const clip = { command, describe, builder, handler };

export default clip;
