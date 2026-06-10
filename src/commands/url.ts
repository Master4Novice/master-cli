import { withJsonFlag, emit, fail } from '../utility/io';

const command = 'url <value>';
const describe = 'Parse a URL into components with decoded query parameters';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('value', { describe: 'URL to parse', type: 'string' })
    .example(
      'mfn url "https://api.x.com/v2/users?id=42&fields=name,bio" --json',
      'all components at once',
    );

const handler = (argv: any) => {
  const raw = String(argv.value);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail(
      argv,
      'InvalidURL',
      `"${raw}" is not a valid absolute URL (include the scheme).`,
      2,
    );
  }

  // searchParams as an object; repeated keys collapse into arrays.
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of u.searchParams) {
    const cur = query[k];
    if (cur === undefined) query[k] = v;
    else if (Array.isArray(cur)) cur.push(v);
    else query[k] = [cur, v];
  }

  const data = {
    href: u.href,
    protocol: u.protocol.replace(/:$/, ''),
    username: u.username || null,
    host: u.host,
    hostname: u.hostname,
    port: u.port ? Number(u.port) : null,
    path: u.pathname,
    pathSegments: u.pathname.split('/').filter(Boolean),
    query,
    queryCount: [...u.searchParams.keys()].length,
    hash: u.hash ? u.hash.slice(1) : null,
    origin: u.origin,
  };
  emit(argv, data, () => {
    console.log(`${data.protocol}://${data.host}${data.path}`);
    for (const [k, v] of Object.entries(query)) console.log(`  ?${k} = ${JSON.stringify(v)}`);
    if (data.hash) console.log(`  #${data.hash}`);
  });
};

const url = { command, describe, builder, handler };

export default url;
