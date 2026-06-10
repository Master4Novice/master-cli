import { createHash, getHashes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

const ALGOS = ['md5', 'sha1', 'sha256', 'sha512'] as const;

const command = 'hash [text]';
const describe = 'Hash a string, file, or stdin (md5/sha1/sha256/sha512)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', {
      describe: 'String to hash (or pipe via stdin, or use --file)',
      type: 'string',
    })
    .option('algo', {
      alias: 'a',
      describe: 'Hash algorithm',
      type: 'string',
      choices: ALGOS as unknown as string[],
      default: 'sha256',
    })
    .option('file', {
      alias: 'f',
      describe: 'Hash the contents of this file instead',
      type: 'string',
    })
    .option('encoding', {
      alias: 'e',
      describe: 'Digest encoding',
      type: 'string',
      choices: ['hex', 'base64', 'base64url'],
      default: 'hex',
    })
    .example('mfn hash hello --json', 'sha256 of "hello"')
    .example('mfn hash -a md5 -f ./file.txt --json', 'md5 of a file')
    .example('cat file | mfn hash --json', 'hash piped stdin');

const handler = async (argv: any) => {
  const algo = String(argv.algo);
  const encoding = String(argv.encoding) as 'hex' | 'base64' | 'base64url';

  let data: Buffer;
  let source: string;
  try {
    if (argv.file !== undefined) {
      data = await readFile(String(argv.file));
      source = `file:${argv.file}`;
    } else if (argv.text !== undefined) {
      data = Buffer.from(String(argv.text), 'utf8');
      source = 'text';
    } else {
      const piped = await readStdin();
      if (!piped) {
        return fail(argv, 'MissingInput', 'Provide a string, --file <path>, or pipe stdin.', 2);
      }
      data = Buffer.from(piped, 'utf8');
      source = 'stdin';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ReadError', message);
  }

  // Guard against an unsupported algo on exotic OpenSSL builds.
  if (!getHashes().includes(algo)) {
    return fail(argv, 'UnsupportedAlgo', `Algorithm "${algo}" is not available.`, 2);
  }

  const digest = createHash(algo).update(data).digest(encoding);
  emit(argv, { algo, encoding, source, bytes: data.length, hash: digest }, () =>
    console.log(digest),
  );
};

const hash = { command, describe, builder, handler };

export default hash;
