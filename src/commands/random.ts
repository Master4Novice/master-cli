import { randomBytes } from 'node:crypto';
import { withJsonFlag, emit, fail } from '../utility/io';

const PASSWORD_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+';

/**
 * Pick `length` chars from `alphabet` using rejection sampling, so the result
 * is uniform even when alphabet length is not a power of two (no modulo bias).
 */
function pick(length: number, alphabet: string): string {
  const n = alphabet.length;
  const limit = Math.floor(256 / n) * n; // largest multiple of n <= 256
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit) {
        out += alphabet[byte % n];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

const command = 'random';
const describe = 'Generate cryptographically secure random bytes or a password';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('bytes', { alias: 'b', describe: 'Number of random bytes', type: 'number', default: 32 })
    .option('encoding', {
      alias: 'e',
      describe: 'Output encoding for bytes',
      type: 'string',
      choices: ['hex', 'base64', 'base64url'],
      default: 'hex',
    })
    .option('password', { alias: 'p', describe: 'Generate a password instead of raw bytes', type: 'boolean', default: false })
    .option('length', { alias: 'l', describe: 'Password length', type: 'number', default: 24 })
    .example('mfn random --json', '32 secure random bytes as hex')
    .example('mfn random -b 16 -e base64url --json', '16 bytes, base64url')
    .example('mfn random -p -l 32 --json', 'a 32-char password');

// Upper bounds keep a fat-fingered huge value from overflowing randomBytes
// (RangeError) — which, in a sync handler, would escape as a stack trace with no
// JSON envelope. Generous for any real CLI use.
const MAX_BYTES = 1_048_576; // 1 MiB
const MAX_PASSWORD = 4096;

const handler = (argv: any) => {
  if (argv.password) {
    const length = Number(argv.length);
    if (!Number.isInteger(length) || length < 1 || length > MAX_PASSWORD) {
      return fail(argv, 'InvalidLength', `--length must be an integer in 1..${MAX_PASSWORD}.`, 2);
    }
    const value = pick(length, PASSWORD_ALPHABET);
    return emit(argv, { kind: 'password', length, value }, () => console.log(value));
  }

  const bytes = Number(argv.bytes);
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_BYTES) {
    return fail(argv, 'InvalidBytes', `--bytes must be an integer in 1..${MAX_BYTES}.`, 2);
  }
  const encoding = String(argv.encoding) as 'hex' | 'base64' | 'base64url';
  const value = randomBytes(bytes).toString(encoding);
  emit(argv, { kind: 'bytes', bytes, encoding, value }, () => console.log(value));
};

const random = { command, describe, builder, handler };

export default random;
