import { withJsonFlag, emit, fail } from '../utility/io';
import { isBlockedUrl, blockedUrlMessage } from '../utility/guard';

const MAX_PREVIEW = 2048;

const command = 'http <url>';
const describe = 'Probe a URL: status, headers, timing, capped body preview (never a full dump)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('url', {
      describe: 'URL to probe (scheme optional — http:// assumed)',
      type: 'string',
    })
    .option('method', {
      alias: 'm',
      describe: 'HTTP method',
      type: 'string',
      choices: ['GET', 'HEAD'],
      default: 'GET',
    })
    .option('timeout', { alias: 't', describe: 'Timeout in seconds', type: 'number', default: 10 })
    .option('header', { alias: 'H', describe: 'Request header(s), "Name: value"', type: 'array' })
    .example('mfn http https://api.github.com --json', 'status + headers + timing')
    .example('mfn http localhost:3000/health --json', 'is my dev server healthy?');

const handler = async (argv: any) => {
  let raw = String(argv.url);
  if (!/^https?:\/\//.test(raw)) raw = `http://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(argv, 'InvalidURL', `"${argv.url}" is not a valid URL.`, 2);
  }
  if (isBlockedUrl(url)) {
    return fail(argv, 'BlockedTarget', blockedUrlMessage(String(url)), 2);
  }
  const timeout = Number(argv.timeout);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120) {
    return fail(argv, 'InvalidTimeout', '--timeout must be 1..120 seconds.', 2);
  }

  const headers: Record<string, string> = {};
  for (const h of ((argv.header as string[]) ?? []).map(String)) {
    const i = h.indexOf(':');
    if (i < 1) return fail(argv, 'InvalidHeader', `Header "${h}" must be "Name: value".`, 2);
    headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
  }

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: String(argv.method),
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout * 1000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? (error.cause as Error)?.message || error.message : String(error);
    return fail(argv, 'RequestFailed', `${url}: ${message}`);
  }
  const timeMs = Date.now() - startedAt;

  let bodyPreview: string | null = null;
  let bodyBytes: number | null = null;
  if (String(argv.method) !== 'HEAD') {
    try {
      const text = await res.text();
      bodyBytes = Buffer.byteLength(text, 'utf8');
      bodyPreview = text.slice(0, MAX_PREVIEW);
    } catch {
      /* body unreadable — headers are still the answer */
    }
  }

  // set-cookie carries session tokens — never hand those to an agent context.
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    responseHeaders[k] = k.toLowerCase() === 'set-cookie' ? '[redacted: session cookie]' : v;
  });

  emit(
    argv,
    {
      url: res.url,
      method: String(argv.method),
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      redirected: res.redirected,
      timeMs,
      headers: responseHeaders,
      bodyBytes,
      bodyPreview,
      bodyTruncated: bodyBytes !== null && bodyBytes > MAX_PREVIEW,
    },
    () => {
      console.log(`${res.status} ${res.statusText}  (${timeMs}ms)  ${res.url}`);
      console.log(`content-type: ${responseHeaders['content-type'] ?? '?'}`);
      if (bodyPreview) console.log(bodyPreview.slice(0, 500));
    },
  );

  if (!res.ok) process.exit(1);
};

const http = { command, describe, builder, handler };

export default http;
