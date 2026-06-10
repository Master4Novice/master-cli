import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const isWin = platform() === 'win32';

// Tool names must look like plain command names — no path separators or shell
// metacharacters. Combined with execFile (no shell), a crafted name can't
// escape into the filesystem or inject commands.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/;

interface ToolInfo {
  name: string;
  found: boolean;
  path: string | null;
  version: string | null;
}

async function locate(name: string): Promise<string | null> {
  try {
    const { stdout } = await run(isWin ? 'where' : 'which', [name]);
    const first = stdout.split('\n')[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

/** Best-effort `<tool> --version`, first line only, 3s cap. */
async function version(name: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(name, ['--version'], { timeout: 3000 });
    const line = (stdout || stderr).split('\n')[0]?.trim();
    return line || null;
  } catch {
    return null;
  }
}

const command = 'have <tools...>';
const describe = 'Check which tools are installed (path + version) in one call';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('tools', {
      describe: 'Command names to look up, e.g. node git docker',
      type: 'string',
    })
    .example('mfn have node git docker --json', 'availability + versions in one shot')
    .example('mfn have rg jq gh --json', 'check optional tooling before using it');

const handler = async (argv: any) => {
  const names = (argv.tools as string[]).map(String);
  for (const n of names) {
    if (!SAFE_NAME.test(n)) {
      return fail(argv, 'InvalidToolName', `"${n}" is not a plain command name.`, 2);
    }
  }

  const tools: ToolInfo[] = await Promise.all(
    names.map(async (name): Promise<ToolInfo> => {
      const path = await locate(name);
      if (!path) return { name, found: false, path: null, version: null };
      return { name, found: true, path, version: await version(name) };
    }),
  );

  const missing = tools.filter((t) => !t.found).map((t) => t.name);
  emit(argv, { count: tools.length, allFound: missing.length === 0, missing, tools }, () => {
    for (const t of tools) {
      console.log(
        t.found ? `✔ ${t.name}  ${t.version ?? ''}  (${t.path})` : `✘ ${t.name}  not found`,
      );
    }
  });
};

const have = { command, describe, builder, handler };

export default have;
