import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * Number base conversion done exactly (BigInt — no precision cliff at 2^53).
 * Input prefix decides the base: 0x… hex, 0b… binary, 0o… octal, plain decimal;
 * --from overrides for unprefixed values.
 */
function parseValue(raw: string, from?: string): { value: bigint; detectedBase: number } {
  const s = raw.trim().toLowerCase().replace(/_/g, '');
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;

  let base: number;
  let digits: string;
  if (body.startsWith('0x')) {
    base = 16;
    digits = body.slice(2);
  } else if (body.startsWith('0b')) {
    base = 2;
    digits = body.slice(2);
  } else if (body.startsWith('0o')) {
    base = 8;
    digits = body.slice(2);
  } else {
    base = from ? { hex: 16, dec: 10, bin: 2, oct: 8 }[from]! : 10;
    digits = body;
  }

  const VALID: Record<number, RegExp> = {
    2: /^[01]+$/,
    8: /^[0-7]+$/,
    10: /^[0-9]+$/,
    16: /^[0-9a-f]+$/,
  };
  if (!digits || !VALID[base].test(digits)) {
    throw new Error(`"${raw}" is not a valid base-${base} number`);
  }

  let value = 0n;
  const B = BigInt(base);
  for (const ch of digits) {
    value = value * B + BigInt(parseInt(ch, 16));
  }
  return { value: negative ? -value : value, detectedBase: base };
}

const MAX_LEN = 4096;

const command = 'base <value>';
const describe = 'Convert a number between bases (hex/dec/bin/oct) exactly — BigInt, no rounding';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('value', { describe: 'Number: 0xff, 0b1010, 0o755, or decimal', type: 'string' })
    .option('from', {
      alias: 'f',
      describe: 'Base of an unprefixed input',
      type: 'string',
      choices: ['hex', 'dec', 'bin', 'oct'],
    })
    .example('mfn base 0xff --json', 'hex → all bases')
    .example('mfn base 255 --json', 'decimal → all bases')
    .example('mfn base ff -f hex --json', 'unprefixed hex');

const handler = (argv: any) => {
  const raw = String(argv.value);
  if (raw.length > MAX_LEN) {
    return fail(argv, 'InputTooLarge', `Input exceeds ${MAX_LEN} characters.`, 2);
  }
  let parsed: { value: bigint; detectedBase: number };
  try {
    parsed = parseValue(raw, argv.from ? String(argv.from) : undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'InvalidNumber', message, 2);
  }
  const v = parsed.value;
  const abs = v < 0n ? -v : v;
  const sign = v < 0n ? '-' : '';
  emit(
    argv,
    {
      input: raw,
      inputBase: parsed.detectedBase,
      dec: v.toString(10),
      hex: `${sign}0x${abs.toString(16)}`,
      bin: `${sign}0b${abs.toString(2)}`,
      oct: `${sign}0o${abs.toString(8)}`,
      bits: abs.toString(2).length,
      exact: true,
    },
    () => {
      console.log(`dec ${v.toString(10)}`);
      console.log(`hex ${sign}0x${abs.toString(16)}`);
      console.log(`bin ${sign}0b${abs.toString(2)}`);
      console.log(`oct ${sign}0o${abs.toString(8)}`);
    },
  );
};

const base = { command, describe, builder, handler };

export default base;
