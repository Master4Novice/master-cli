import fs from 'node:fs';
import path from 'node:path';
import { withJsonFlag, emit, fail } from '../utility/io';

interface DepInfo {
  name: string;
  declared: string;
  section: string;
  installed: string | null;
  satisfiesExact: boolean | null;
}

function readJson(file: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Installed version straight from node_modules/<name>/package.json. */
function installedVersion(root: string, name: string): string | null {
  const p = path.join(root, 'node_modules', ...name.split('/'), 'package.json');
  return readJson(p)?.version ?? null;
}

/** Cheap "does the installed version literally match the declared pin?" check. */
function exactMatch(declared: string, installed: string | null): boolean | null {
  if (installed === null) return false;
  const pin = declared.replace(/^[\^~>=<]+/, '');
  if (declared === installed) return true;
  if (/^\d/.test(pin) && pin === installed) return true;
  return null; // range — satisfied-ness needs a resolver; report versions, don't guess
}

const command = 'pkg [name]';
const describe = 'Declared vs installed dependency versions — drift and missing installs';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('name', { describe: 'One dependency to inspect (omit for all)', type: 'string' })
    .example('mfn pkg --json', 'is node_modules in sync with package.json?')
    .example('mfn pkg typescript --json', 'one dependency, declared vs actually installed');

const handler = (argv: any) => {
  const root = process.cwd();
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg) return fail(argv, 'NoPackageJson', `No readable package.json in ${root}`);

  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const deps: DepInfo[] = [];
  for (const section of sections) {
    for (const [name, declared] of Object.entries(pkg[section] ?? {})) {
      if (argv.name !== undefined && name !== String(argv.name)) continue;
      const installed = installedVersion(root, name);
      deps.push({
        name,
        declared: String(declared),
        section,
        installed,
        satisfiesExact: exactMatch(String(declared), installed),
      });
    }
  }
  if (argv.name !== undefined && deps.length === 0) {
    return fail(argv, 'NotDeclared', `"${argv.name}" is not declared in package.json.`);
  }

  const missing = deps.filter((d) => d.installed === null).map((d) => d.name);
  emit(
    argv,
    {
      package: pkg.name ?? null,
      version: pkg.version ?? null,
      depCount: deps.length,
      missing,
      allInstalled: missing.length === 0,
      deps,
    },
    () => {
      for (const d of deps) {
        const mark = d.installed === null ? '✘ missing' : d.installed;
        console.log(`${d.name.padEnd(40)} ${d.declared.padEnd(12)} → ${mark}`);
      }
      if (missing.length) console.log(`\n${missing.length} not installed — run your installer`);
    },
  );
};

const pkgCmd = { command, describe, builder, handler };

export default pkgCmd;
