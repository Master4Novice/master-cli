import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const os = platform();

/**
 * Desktop notification — how a long-running agent task tells the human it's
 * done without them watching the terminal. All arguments are passed as argv
 * entries (execFile, no shell); on macOS the strings are embedded in
 * AppleScript, so quotes/backslashes are escaped first.
 */
const escapeAppleScript = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

async function send(title: string, message: string): Promise<void> {
  if (os === 'darwin') {
    const script = `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`;
    await run('osascript', ['-e', script], { timeout: 5000 });
  } else if (os === 'win32') {
    // PowerShell toast via the WinRT API. Title/message arrive as ENVIRONMENT
    // VARIABLES — `-Command <script> <arg>` appends args to the command text
    // (they are NOT $args), so env is the only way to pass data unparsed.
    const script =
      "$ErrorActionPreference='Stop';" +
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;' +
      '$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);' +
      '$n=$t.GetElementsByTagName("text");$n.Item(0).AppendChild($t.CreateTextNode($env:MFN_NOTIFY_TITLE))|Out-Null;' +
      '$n.Item(1).AppendChild($t.CreateTextNode($env:MFN_NOTIFY_MESSAGE))|Out-Null;' +
      '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("mfn").Show([Windows.UI.Notifications.ToastNotification]::new($t))';
    await run('powershell', ['-NoProfile', '-Command', script], {
      timeout: 10_000,
      env: { ...process.env, MFN_NOTIFY_TITLE: title, MFN_NOTIFY_MESSAGE: message },
    });
  } else {
    await run('notify-send', [title, message], { timeout: 5000 });
  }
}

const MAX_LEN = 2000;

const command = 'notify <message>';
const describe = 'Send a desktop notification (macOS/Windows/Linux) — ping the user, hands-free';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('message', { describe: 'Notification body', type: 'string' })
    .option('title', { alias: 't', describe: 'Notification title', type: 'string', default: 'mfn' })
    .example('mfn notify "build finished" --json', 'tell the user a long task is done')
    .example('mfn notify "3 tests failing" -t "CI watch" --json', 'titled notification');

const handler = async (argv: any) => {
  const message = String(argv.message);
  const title = String(argv.title);
  if (message.length > MAX_LEN || title.length > MAX_LEN) {
    return fail(argv, 'InputTooLarge', `Title/message are capped at ${MAX_LEN} chars.`, 2);
  }
  try {
    await send(title, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return fail(
      argv,
      'NotifyFailed',
      `Could not send a notification (headless session? missing notify-send?): ${msg}`,
    );
  }
  emit(argv, { sent: true, title, message }, () => console.log('notification sent'));
};

const notify = { command, describe, builder, handler };

export default notify;
