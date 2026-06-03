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
    return fail(argv, 'InvalidJWT', 'Invalid JWT structure: expected three dot-separated segments.');
  }

  let header: unknown;
  let payload: unknown;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'DecodeError', `Could not decode JWT: ${message}`);
  }

  emit(argv, { header, payload }, () => {
    logger.info('Decoded JWT (signature NOT verified)');
    console.log(chalk.cyanBright.bold('header:'));
    console.log(chalk.greenBright(JSON.stringify(header, null, 2)));
    console.log(chalk.cyanBright.bold('payload:'));
    console.log(chalk.greenBright(JSON.stringify(payload, null, 2)));
  });
};

const deco = { command, describe, builder, handler };

export default deco;
