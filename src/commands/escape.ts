import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

/**
 * Escaping is where agents most often produce subtly broken output — a missed
 * quote in shell, a raw newline in JSON, an unescaped dot in regex. This makes
 * each escape exact and verifiable.
 */
const ESCAPERS: Record<string, (s: string) => string> = {
  // POSIX shell single-quote: close, insert \' , reopen.
  shell: (s) => `'${s.replace(/'/g, `'\\''`)}'`,
  // JSON string body (quotes included so it's paste-ready).
  json: (s) => JSON.stringify(s),
  // Escape every regex metacharacter so the string matches itself literally.
  regex: (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  html: (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
  url: (s) => encodeURIComponent(s),
  // C-style/JS string body without surrounding quotes.
  string: (s) => JSON.stringify(s).slice(1, -1),
};

const MODES = Object.keys(ESCAPERS);
const MAX_INPUT = 1_000_000;

const command = 'escape [text]';
const describe = 'Escape text exactly for shell, JSON, regex, HTML, or URL contexts';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', { describe: 'Text to escape (or pipe via stdin)', type: 'string' })
    .option('as', {
      alias: 'a',
      describe: 'Target context',
      type: 'string',
      choices: MODES,
      default: 'shell',
    })
    .example(`mfn escape "it's done" --json`, 'safe single-quoted shell string')
    .example('mfn escape "1.2.3" -a regex --json', 'regex-literal: 1\\.2\\.3')
    .example("mfn escape 'line1\nline2' -a json --json", 'paste-ready JSON string');

const handler = async (argv: any) => {
  let input: string;
  if (argv.text !== undefined) {
    input = String(argv.text);
  } else {
    input = (await readStdin()).replace(/\n$/, '');
    if (!input) return fail(argv, 'MissingInput', 'Provide text or pipe stdin.', 2);
  }
  if (input.length > MAX_INPUT) {
    return fail(argv, 'InputTooLarge', `Input exceeds ${MAX_INPUT} characters.`, 2);
  }
  const mode = String(argv.as);
  const output = ESCAPERS[mode](input);
  emit(argv, { mode, input, output }, () => console.log(output));
};

const escapeCmd = { command, describe, builder, handler };

export default escapeCmd;
