import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';
import { outline as buildOutline, SUPPORTED_EXTENSIONS } from './outline.engine';

const command = 'outline <file>';
const describe = 'Outline a source file — symbols + line numbers, not the whole file';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('file', { describe: 'Source file (.ts .js .tsx .py .go .md …)', type: 'string' })
    .option('kind', {
      alias: 'k',
      describe: 'Only symbols of this kind (function, class, …)',
      type: 'string',
    })
    .option('exported', {
      alias: 'e',
      describe: 'Only exported symbols (TS/JS)',
      type: 'boolean',
      default: false,
    })
    .example('mfn outline src/app.ts --json', 'structure of a file in ~50 tokens')
    .example('mfn outline src/app.ts -k function -e --json', 'just the exported functions');

const handler = async (argv: any) => {
  const file = String(argv.file);
  const extension = path.extname(file).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return fail(
      argv,
      'UnsupportedType',
      `"${extension || file}" is not outlineable. Supported: ${SUPPORTED_EXTENSIONS.join(' ')}`,
      2,
    );
  }

  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  let symbols = buildOutline(text, extension);
  if (argv.kind) symbols = symbols.filter((s) => s.kind === String(argv.kind));
  if (argv.exported) symbols = symbols.filter((s) => s.exported);

  const totalLines = text.split('\n').length;
  emit(argv, { file, totalLines, count: symbols.length, symbols }, () => {
    for (const s of symbols) {
      console.log(`${String(s.line).padStart(5)}  ${s.kind.padEnd(9)} ${s.name}`);
    }
  });
};

const outlineCmd = { command, describe, builder, handler };

export default outlineCmd;
