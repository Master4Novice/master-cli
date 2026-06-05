import { randomUUID, randomBytes } from 'node:crypto';
import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * UUID v7 per RFC 9562: 48-bit big-endian Unix-ms timestamp, version nibble
 * 0b0111, variant bits 0b10. Time-ordered, so ids sort by creation time.
 */
function uuidV7(): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(Date.now(), 0, 6); // 48-bit ms timestamp into bytes[0..5]
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// 64-char URL-safe alphabet. Because 64 is a power of two, `byte & 63` maps
// uniformly onto it — no modulo bias.
const NANO_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function nano(size: number): string {
  let id = '';
  while (id.length < size) {
    const bytes = randomBytes(size);
    for (let i = 0; i < bytes.length && id.length < size; i++) {
      id += NANO_ALPHABET[bytes[i] & 63];
    }
  }
  return id;
}

function generate(type: string): string {
  switch (type) {
    case 'uuid':
    case 'uuid4':
      return randomUUID();
    case 'uuid7':
      return uuidV7();
    default:
      // nano handled by caller (needs size)
      return '';
  }
}

const command = 'id';
const describe = 'Generate identifiers (UUID v4/v7 or URL-safe nano id)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('type', {
      alias: 't',
      describe: 'Identifier type',
      type: 'string',
      choices: ['uuid', 'uuid4', 'uuid7', 'nano'],
      default: 'uuid',
    })
    .option('count', { alias: 'n', describe: 'How many to generate', type: 'number', default: 1 })
    .option('size', { describe: 'Length for --type nano', type: 'number', default: 21 })
    .example('mfn id --json', 'one UUID v4')
    .example('mfn id -t uuid7 -n 3 --json', 'three time-ordered UUID v7')
    .example('mfn id -t nano --size 12 --json', 'a 12-char URL-safe id');

const handler = (argv: any) => {
  const type = String(argv.type);
  const count = Number(argv.count);
  const size = Number(argv.size);
  if (!Number.isInteger(count) || count < 1) {
    return fail(argv, 'InvalidCount', '--count must be a positive integer.', 2);
  }
  if (type === 'nano' && (!Number.isInteger(size) || size < 1)) {
    return fail(argv, 'InvalidSize', '--size must be a positive integer.', 2);
  }
  const ids = Array.from({ length: count }, () =>
    type === 'nano' ? nano(size) : generate(type),
  );
  emit(argv, { type, count, ids }, () => ids.forEach((id) => console.log(id)));
};

const id = { command, describe, builder, handler };

export default id;
