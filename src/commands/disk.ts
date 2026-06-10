import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { withJsonFlag, emit, fail } from '../utility/io';

const run = promisify(execFile);
const isWin = platform() === 'win32';

interface Mount {
  mount: string;
  filesystem: string | null;
  totalBytes: number;
  freeBytes: number;
  usedPercent: number;
}

/** Unix: POSIX `df -kP` — stable columns, sizes in 1K blocks. */
async function unixMounts(): Promise<Mount[]> {
  const { stdout } = await run('df', ['-kP'], { timeout: 10_000 });
  const out: Mount[] = [];
  for (const line of stdout.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6) continue;
    const total = Number(cols[1]) * 1024;
    const free = Number(cols[3]) * 1024;
    if (!Number.isFinite(total) || total === 0) continue;
    out.push({
      mount: cols.slice(5).join(' '),
      filesystem: cols[0],
      totalBytes: total,
      freeBytes: free,
      usedPercent: Math.round(((total - free) / total) * 100),
    });
  }
  return out;
}

/** Windows: CIM logical disks as JSON straight from PowerShell. */
async function winMounts(): Promise<Mount[]> {
  const { stdout } = await run(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json',
    ],
    { timeout: 15_000 },
  );
  const parsed = JSON.parse(stdout);
  const disks = Array.isArray(parsed) ? parsed : [parsed];
  return disks
    .filter((d) => Number(d.Size) > 0)
    .map((d) => ({
      mount: String(d.DeviceID),
      filesystem: null,
      totalBytes: Number(d.Size),
      freeBytes: Number(d.FreeSpace),
      usedPercent: Math.round(((Number(d.Size) - Number(d.FreeSpace)) / Number(d.Size)) * 100),
    }));
}

const human = (b: number) =>
  b >= 1024 ** 4 ? `${(b / 1024 ** 4).toFixed(1)}T` : `${(b / 1024 ** 3).toFixed(1)}G`;

const command = 'disk';
const describe = 'Disk usage per mount (total/free/used%) — df parsing done for you';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .option('all', {
      alias: 'a',
      describe: 'Include pseudo/small filesystems (< 1GB)',
      type: 'boolean',
      default: false,
    })
    .example('mfn disk --json', 'is there room for this build?');

const handler = async (argv: any) => {
  let mounts: Mount[];
  try {
    mounts = isWin ? await winMounts() : await unixMounts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'DiskError', `Could not read disk usage: ${message}`);
  }
  if (!argv.all) {
    mounts = mounts.filter(
      (m) => m.totalBytes >= 1024 ** 3 && !/^\/(dev|proc|sys|run)/.test(m.mount),
    );
  }
  mounts.sort((a, b) => b.totalBytes - a.totalBytes);

  emit(argv, { count: mounts.length, mounts }, () => {
    for (const m of mounts) {
      console.log(
        `${human(m.totalBytes).padStart(8)} total  ${human(m.freeBytes).padStart(8)} free  ${String(m.usedPercent).padStart(3)}%  ${m.mount}`,
      );
    }
  });
};

const disk = { command, describe, builder, handler };

export default disk;
