import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

/** Split an identifier/phrase into lowercase words (handles camelCase, snake, kebab, spaces). */
function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTTPServer → HTTP Server
    .split(/[\s_\-./]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

const CONVERTERS: Record<string, (w: string[]) => string> = {
  camel: (w) => w.map((x, i) => (i === 0 ? x : cap(x))).join(''),
  pascal: (w) => w.map(cap).join(''),
  snake: (w) => w.join('_'),
  kebab: (w) => w.join('-'),
  constant: (w) => w.join('_').toUpperCase(),
  dot: (w) => w.join('.'),
  path: (w) => w.join('/'),
  title: (w) => w.map(cap).join(' '),
  sentence: (w) => cap(w.join(' ')),
  lower: (w) => w.join(' '),
  upper: (w) => w.join(' ').toUpperCase(),
};

const STYLES = Object.keys(CONVERTERS);
const MAX_INPUT = 100_000;

const command = 'case [text]';
const describe = 'Convert a string between naming styles (camel, snake, kebab, pascal, …)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', { describe: 'Text to convert (or pipe via stdin)', type: 'string' })
    .option('to', {
      alias: 't',
      describe: 'Target style (omit for all styles at once)',
      type: 'string',
      choices: STYLES,
    })
    .example('mfn case "user profile id" -t camel --json', '→ userProfileId')
    .example('mfn case getUserName -t snake --json', '→ get_user_name')
    .example('mfn case my-component --json', 'all styles in one call');

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

  const w = words(input);
  if (w.length === 0) return fail(argv, 'NoWords', 'Input contains no convertible words.', 2);

  if (argv.to) {
    const style = String(argv.to);
    const output = CONVERTERS[style](w);
    return emit(argv, { input, style, output }, () => console.log(output));
  }

  const all = Object.fromEntries(STYLES.map((s) => [s, CONVERTERS[s](w)]));
  emit(argv, { input, words: w, styles: all }, () => {
    for (const [style, value] of Object.entries(all)) console.log(`${style.padEnd(9)} ${value}`);
  });
};

const caseCmd = { command, describe, builder, handler };

export default caseCmd;
