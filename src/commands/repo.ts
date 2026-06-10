import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);

/** Run a git command via execFile (no shell); null instead of throwing. */
async function git(...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run('git', args, { timeout: 10_000 });
    return stdout.trimEnd();
  } catch {
    return null;
  }
}

const command = 'repo';
const describe = 'One-shot git repo summary (branch, dirty counts, ahead/behind, last commits)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('commits', {
      alias: 'n',
      describe: 'How many recent commits to include',
      type: 'number',
      default: 5,
    })
    .example('mfn repo --json', 'replaces git status + git log + git branch + git remote');

const handler = async (argv: any) => {
  const n = Number(argv.commits);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    return fail(argv, 'InvalidCount', '--commits must be an integer in 0..100.', 2);
  }

  const inside = await git('rev-parse', '--is-inside-work-tree');
  if (inside !== 'true') {
    return fail(argv, 'NotARepo', `Not inside a git repository: ${process.cwd()}`);
  }

  const [root, branch, statusRaw, aheadBehind, remoteRaw, logRaw] = await Promise.all([
    git('rev-parse', '--show-toplevel'),
    git('rev-parse', '--abbrev-ref', 'HEAD'),
    git('status', '--porcelain'),
    git('rev-list', '--left-right', '--count', '@{upstream}...HEAD'),
    git('remote', '-v'),
    n > 0
      ? git('log', `-${n}`, '--pretty=format:%h%x09%an%x09%ad%x09%s', '--date=short')
      : Promise.resolve(''),
  ]);

  // Porcelain: XY <path>. X = staged state, Y = worktree state, ?? = untracked.
  const lines = (statusRaw ?? '').split('\n').filter(Boolean);
  const untracked = lines.filter((l) => l.startsWith('??')).length;
  const staged = lines.filter((l) => !l.startsWith('??') && l[0] !== ' ').length;
  const unstaged = lines.filter((l) => !l.startsWith('??') && l[1] !== ' ').length;

  let ahead: number | null = null;
  let behind: number | null = null;
  if (aheadBehind) {
    const [b, a] = aheadBehind.split('\t').map(Number);
    behind = Number.isFinite(b) ? b : null;
    ahead = Number.isFinite(a) ? a : null;
  }

  const remotes = Array.from(
    new Map(
      (remoteRaw ?? '')
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const [name, url] = l.split(/\s+/);
          return [name, { name, url }] as const;
        }),
    ).values(),
  );

  const commits = (logRaw ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [hash, author, date, ...subject] = l.split('\t');
      return { hash, author, date, subject: subject.join('\t') };
    });

  const clean = lines.length === 0;
  emit(
    argv,
    {
      root,
      branch,
      clean,
      staged,
      unstaged,
      untracked,
      ahead,
      behind,
      hasUpstream: aheadBehind !== null,
      remotes,
      commits,
    },
    () => {
      console.log(`${root}  (${branch})`);
      console.log(
        clean ? 'clean' : `staged ${staged} · unstaged ${unstaged} · untracked ${untracked}`,
      );
      if (ahead !== null) console.log(`ahead ${ahead} · behind ${behind}`);
      for (const c of commits) console.log(`${c.hash} ${c.date} ${c.subject}`);
    },
  );
};

const repo = { command, describe, builder, handler };

export default repo;
