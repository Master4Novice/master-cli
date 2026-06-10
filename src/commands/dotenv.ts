import fs from 'node:fs';
import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * Parse .env-style lines into key names. VALUES ARE NEVER RETURNED — the
 * command exists to answer "is my env complete?", and env values are exactly
 * what must not leak into an agent's context or logs.
 */
function parseKeys(text: string): string[] {
  const keys: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const command = 'dotenv';
const describe = 'Check .env against .env.example — missing/extra keys, values never shown';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('file', { alias: 'f', describe: 'Env file to check', type: 'string', default: '.env' })
    .option('example', {
      alias: 'e',
      describe: 'Reference file',
      type: 'string',
      default: '.env.example',
    })
    .example('mfn dotenv --json', 'is .env complete vs .env.example?')
    .example('mfn dotenv -f .env.local -e .env.example --json', 'check a specific pair');

const handler = (argv: any) => {
  const file = String(argv.file);
  const example = String(argv.example);

  let fileText: string | null = null;
  let exampleText: string | null = null;
  try {
    fileText = fs.readFileSync(file, 'utf8');
  } catch {
    /* reported below */
  }
  try {
    exampleText = fs.readFileSync(example, 'utf8');
  } catch {
    /* reported below */
  }
  if (fileText === null && exampleText === null) {
    return fail(
      argv,
      'NotFound',
      `Neither ${file} nor ${example} is readable in ${process.cwd()}.`,
    );
  }

  const fileKeys = fileText !== null ? parseKeys(fileText) : [];
  const exampleKeys = exampleText !== null ? parseKeys(exampleText) : [];
  const fileSet = new Set(fileKeys);
  const exampleSet = new Set(exampleKeys);

  const missing = exampleKeys.filter((k) => !fileSet.has(k)); // required but absent
  const extra = fileKeys.filter((k) => !exampleSet.has(k)); // present but undocumented
  const complete = exampleText === null ? null : missing.length === 0;

  emit(
    argv,
    {
      file,
      fileExists: fileText !== null,
      example,
      exampleExists: exampleText !== null,
      fileKeyCount: fileKeys.length,
      exampleKeyCount: exampleKeys.length,
      missing,
      extra,
      complete,
      note: 'values are intentionally never read or returned',
    },
    () => {
      if (fileText === null) console.log(`${file} does not exist`);
      if (exampleText === null) console.log(`${example} does not exist`);
      if (complete === true)
        console.log(`✔ ${file} has all ${exampleKeys.length} keys from ${example}`);
      if (missing.length) console.log(`missing: ${missing.join(', ')}`);
      if (extra.length) console.log(`extra (undocumented): ${extra.join(', ')}`);
    },
  );
};

const dotenv = { command, describe, builder, handler };

export default dotenv;
