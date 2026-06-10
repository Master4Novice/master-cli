import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

const MAX_PATTERN = 1000;
const MAX_MATCHES = 1000;

const command = 'regex <pattern> [text]';
const describe = 'Test a regular expression against text — verify instead of guessing';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('pattern', {
      describe: 'Regular expression (without surrounding slashes)',
      type: 'string',
    })
    .positional('text', { describe: 'Text to test (or --file / stdin)', type: 'string' })
    .option('file', {
      alias: 'f',
      describe: 'Test against the contents of this file',
      type: 'string',
    })
    .option('flags', { describe: 'Regex flags (g is always added)', type: 'string', default: '' })
    .example('mfn regex "^v\\\\d+\\\\.\\\\d+" "v1.22.0" --json', 'does it match?')
    .example('mfn regex "TODO[:!]?" -f src/app.ts --json', 'all matches with positions and groups');

const handler = async (argv: any) => {
  const pattern = String(argv.pattern);
  if (pattern.length > MAX_PATTERN) {
    return fail(argv, 'PatternTooLong', `Pattern exceeds ${MAX_PATTERN} characters.`, 2);
  }
  const flagsIn = String(argv.flags ?? '');
  if (!/^[imsuvy]*$/.test(flagsIn)) {
    return fail(argv, 'InvalidFlags', `Flags may only contain i m s u v y (g is implicit).`, 2);
  }

  let re: RegExp;
  try {
    re = new RegExp(pattern, flagsIn.includes('g') ? flagsIn : flagsIn + 'g');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'InvalidRegex', message, 2);
  }

  let text: string;
  let source: string;
  try {
    if (argv.file !== undefined) {
      text = await readFile(String(argv.file), 'utf8');
      source = `file:${argv.file}`;
    } else if (argv.text !== undefined) {
      text = String(argv.text);
      source = 'text';
    } else {
      text = await readStdin();
      if (!text)
        return fail(argv, 'MissingInput', 'Provide text, --file <path>, or pipe stdin.', 2);
      source = 'stdin';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  const matches: { match: string; index: number; line: number; groups: string[] }[] = [];
  let truncated = false;
  for (const m of text.matchAll(re)) {
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    const line = text.slice(0, m.index).split('\n').length;
    matches.push({ match: m[0], index: m.index, line, groups: m.slice(1) });
    if (m[0] === '') break; // zero-length match — avoid pathological loops
  }

  emit(
    argv,
    {
      pattern,
      flags: re.flags,
      source,
      matched: matches.length > 0,
      count: matches.length,
      truncated,
      matches,
    },
    () => {
      if (matches.length === 0) return console.log('no match');
      for (const m of matches) console.log(`line ${m.line} @${m.index}: ${m.match}`);
    },
  );
};

const regex = { command, describe, builder, handler };

export default regex;
