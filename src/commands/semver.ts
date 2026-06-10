import { withJsonFlag, emit, fail } from '../utility/io';

/** Parsed semver per semver.org 2.0.0 (numeric core + optional prerelease/build). */
interface SemVer {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string | null;
}

const RE =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parse(raw: string): SemVer | null {
  const m = RE.exec(raw.trim());
  if (!m) return null;
  return {
    raw: raw.trim(),
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
    build: m[5] ?? null,
  };
}

/** semver.org §11: numeric core, then prerelease (absence > presence). */
function compare(a: SemVer, b: SemVer): -1 | 0 | 1 {
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1; // release > prerelease
  if (b.prerelease.length === 0) return -1;
  const len = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < len; i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1; // shorter set is lower
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    } else if (xn !== yn) {
      return xn ? -1 : 1; // numeric < alphanumeric
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

function bump(v: SemVer, part: string): string {
  if (part === 'major') return `${v.major + 1}.0.0`;
  if (part === 'minor') return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

const command = 'semver <versions...>';
const describe = 'Validate, compare, sort, or bump semantic versions (exact, per semver.org)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('versions', { describe: 'One or more versions', type: 'string' })
    .option('bump', {
      alias: 'b',
      describe: 'Bump the (single) version',
      type: 'string',
      choices: ['major', 'minor', 'patch'],
    })
    .option('sort', {
      alias: 's',
      describe: 'Sort all given versions ascending',
      type: 'boolean',
      default: false,
    })
    .example('mfn semver 1.2.3 --json', 'validate + parse one version')
    .example('mfn semver 1.10.0 1.9.2 --json', 'compare two (1.10.0 > 1.9.2 — string sort lies)')
    .example('mfn semver 2.0.0-rc.1 2.0.0 --sort --json', 'prerelease ordering done right')
    .example('mfn semver 1.2.3 -b minor --json', 'bump → 1.3.0');

const handler = (argv: any) => {
  const raws = (argv.versions as string[]).map(String);
  const parsed: SemVer[] = [];
  for (const r of raws) {
    const v = parse(r);
    if (!v) return fail(argv, 'InvalidVersion', `"${r}" is not a valid semantic version.`, 2);
    parsed.push(v);
  }

  if (argv.bump) {
    if (parsed.length !== 1) {
      return fail(argv, 'TooManyVersions', '--bump takes exactly one version.', 2);
    }
    const result = bump(parsed[0], String(argv.bump));
    return emit(argv, { input: parsed[0].raw, bump: argv.bump, result }, () => console.log(result));
  }

  if (argv.sort || parsed.length > 2) {
    const sorted = [...parsed].sort(compare).map((v) => v.raw);
    return emit(argv, { count: sorted.length, sorted, latest: sorted[sorted.length - 1] }, () =>
      sorted.forEach((v) => console.log(v)),
    );
  }

  if (parsed.length === 2) {
    const c = compare(parsed[0], parsed[1]);
    return emit(
      argv,
      {
        a: parsed[0].raw,
        b: parsed[1].raw,
        comparison: c,
        relation: c === 0 ? 'equal' : c < 0 ? 'a < b' : 'a > b',
        greater: c >= 0 ? parsed[0].raw : parsed[1].raw,
      },
      () =>
        console.log(
          c === 0 ? 'equal' : c < 0 ? `${parsed[1].raw} is greater` : `${parsed[0].raw} is greater`,
        ),
    );
  }

  const v = parsed[0];
  emit(
    argv,
    {
      version: v.raw,
      valid: true,
      major: v.major,
      minor: v.minor,
      patch: v.patch,
      prerelease: v.prerelease.length ? v.prerelease.join('.') : null,
      build: v.build,
      isPrerelease: v.prerelease.length > 0,
    },
    () => console.log(`${v.major}.${v.minor}.${v.patch} valid`),
  );
};

const semver = { command, describe, builder, handler };

export default semver;
