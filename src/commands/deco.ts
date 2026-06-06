import chalk from 'chalk';
import { Logger } from '../utility';
import { withJsonFlag, emit, fail } from '../utility/io';

const logger = Logger();

function decodeSegment(segment: string): unknown {
  // JWT segments are base64url. Node's 'base64url' decoder handles the URL
  // alphabet and missing padding.
  const json = Buffer.from(segment, 'base64url').toString('utf-8');
  return JSON.parse(json);
}

const command = 'decode';
const describe = 'Decode a JWT token (header + payload; signature not verified)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('token', {
      alias: 't',
      describe: 'JWT token to decode (a leading "Bearer " is stripped)',
      type: 'string',
      demandOption: true,
    })
    .example('mfn decode -t <jwt> --json', 'decode a JWT');

const handler = (argv: any) => {
  const token = String(argv.token).replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return fail(argv, 'InvalidJWT', 'Invalid JWT structure: expected three dot-separated segments.', 2);
  }

  let header: unknown;
  let payload: unknown;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'DecodeError', `Could not decode JWT: ${message}`, 2);
  }

  // Expiry helper: if the payload carries a numeric `exp` (seconds since epoch,
  // per RFC 7519), surface whether it's expired and seconds remaining — so an
  // agent doesn't have to do the math.
  const exp = (payload as { exp?: unknown })?.exp;
  let expiry: { exp: number; expired: boolean; expiresInSeconds: number } | undefined;
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    const expiresInSeconds = Math.round(exp - Date.now() / 1000);
    expiry = { exp, expired: expiresInSeconds <= 0, expiresInSeconds };
  }

  emit(argv, { header, payload, ...(expiry ? { expiry } : {}) }, () => {
    logger.info('Decoded JWT (signature NOT verified)');
    console.log(chalk.cyanBright.bold('header:'));
    console.log(chalk.greenBright(JSON.stringify(header, null, 2)));
    console.log(chalk.cyanBright.bold('payload:'));
    console.log(chalk.greenBright(JSON.stringify(payload, null, 2)));
    if (expiry) {
      console.log(
        chalk.cyanBright.bold('expiry: ') +
          (expiry.expired
            ? chalk.red(`expired ${-expiry.expiresInSeconds}s ago`)
            : chalk.green(`valid for ${expiry.expiresInSeconds}s`)),
      );
    }
  });
};

const deco = { command, describe, builder, handler };

export default deco;
