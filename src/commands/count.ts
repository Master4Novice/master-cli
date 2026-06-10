import { readFile, stat } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

/**
 * Rough LLM token estimate. Real tokenizers vary by model; ~4 characters per
 * token is the widely used heuristic for English/code. Reported as `tokensEstimate`
 * (never `tokens`) so nobody mistakes it for an exact count.
 */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const command = 'count [text]';
const describe = 'Count lines/words/chars/bytes + LLM token estimate (file, stdin, or text)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', {
      describe: 'Text to measure (or use --file / pipe stdin)',
      type: 'string',
    })
    .option('file', { alias: 'f', describe: 'Measure the contents of this file', type: 'string' })
    .example('mfn count -f big.log --json', 'size facts before deciding to read a file')
    .example('git diff | mfn count --json', 'how big is this diff, in tokens?');

const handler = async (argv: any) => {
  let text: string;
  let source: string;
  let bytes: number;
  try {
    if (argv.file !== undefined) {
      const file = String(argv.file);
      text = await readFile(file, 'utf8');
      bytes = (await stat(file)).size;
      source = `file:${file}`;
    } else if (argv.text !== undefined) {
      text = String(argv.text);
      bytes = Buffer.byteLength(text, 'utf8');
      source = 'text';
    } else {
      text = await readStdin();
      if (!text) {
        return fail(argv, 'MissingInput', 'Provide text, --file <path>, or pipe stdin.', 2);
      }
      bytes = Buffer.byteLength(text, 'utf8');
      source = 'stdin';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  const lines = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  const words = (text.match(/\S+/g) ?? []).length;
  const result = {
    source,
    lines,
    words,
    chars: text.length,
    bytes,
    tokensEstimate: estimateTokens(text),
  };
  emit(argv, result, () => {
    console.log(
      `lines ${lines} · words ${words} · chars ${text.length} · bytes ${bytes} · ~${result.tokensEstimate} tokens`,
    );
  });
};

const count = { command, describe, builder, handler };

export default count;
