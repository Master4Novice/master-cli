import { withJsonFlag, emit, fail, readStdin } from '../utility/io';

type Codec = 'base64' | 'base64url' | 'hex' | 'url';

function encode(text: string, codec: Codec): string {
  switch (codec) {
    case 'base64':
      return Buffer.from(text, 'utf8').toString('base64');
    case 'base64url':
      return Buffer.from(text, 'utf8').toString('base64url');
    case 'hex':
      return Buffer.from(text, 'utf8').toString('hex');
    case 'url':
      return encodeURIComponent(text);
  }
}

// Buffer.from is lenient — it silently drops invalid characters (e.g.
// `from('zzz','hex')` → empty) instead of erroring. Validate the input charset
// first so decoding garbage fails loudly rather than returning "".
const VALID: Partial<Record<Codec, RegExp>> = {
  hex: /^[0-9a-fA-F]*$/,
  base64: /^[A-Za-z0-9+/]*={0,2}$/,
  base64url: /^[A-Za-z0-9_-]*$/,
};

function decode(text: string, codec: Codec): string {
  if (codec === 'url') return decodeURIComponent(text);

  const pattern = VALID[codec]!;
  const compact = codec === 'hex' ? text : text.trim();
  if (!pattern.test(compact) || (codec === 'hex' && compact.length % 2 !== 0)) {
    throw new Error(`not valid ${codec}`);
  }
  return Buffer.from(compact, codec).toString('utf8');
}

const command = 'encode [text]';
const describe = 'Encode/decode text (base64, base64url, hex, url)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('text', { describe: 'Text to (de/en)code (or pipe via stdin)', type: 'string' })
    .option('as', {
      alias: 'a',
      describe: 'Codec',
      type: 'string',
      choices: ['base64', 'base64url', 'hex', 'url'],
      default: 'base64',
    })
    .option('decode', {
      alias: 'd',
      describe: 'Decode instead of encode',
      type: 'boolean',
      default: false,
    })
    .example('mfn encode hello --json', 'base64-encode "hello"')
    .example('mfn encode aGVsbG8= -d --json', 'base64-decode')
    .example('mfn encode "a b&c" --as url --json', 'url-encode');

const handler = async (argv: any) => {
  const codec = String(argv.as) as Codec;
  const decoding = Boolean(argv.decode);

  let input: string;
  if (argv.text !== undefined) {
    input = String(argv.text);
  } else {
    input = (await readStdin()).replace(/\n$/, '');
    if (!input) return fail(argv, 'MissingInput', 'Provide text or pipe stdin.', 2);
  }

  let output: string;
  try {
    output = decoding ? decode(input, codec) : encode(input, codec);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(
      argv,
      'CodecError',
      `Could not ${decoding ? 'decode' : 'encode'} as ${codec}: ${message}`,
    );
  }

  emit(argv, { operation: decoding ? 'decode' : 'encode', codec, input, output }, () =>
    console.log(output),
  );
};

const encodeCmd = { command, describe, builder, handler };

export default encodeCmd;
