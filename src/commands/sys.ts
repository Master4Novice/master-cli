import os from 'node:os';
import { withJsonFlag, emit } from '../utility/io';

const command = 'sys';
const describe = 'One-shot system facts (OS, node, CPU, memory, shell, timezone, paths)';

const builder = (yargs: any) =>
  withJsonFlag(yargs).example(
    'mfn sys --json',
    'everything an agent usually probes with 5+ separate commands',
  );

const handler = (argv: any) => {
  const cpus = os.cpus();
  const data = {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osVersion: os.version(),
    hostname: os.hostname(),
    node: process.version,
    cpu: { model: cpus[0]?.model ?? 'unknown', cores: cpus.length },
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      totalGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      freeGB: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
    },
    user: os.userInfo().username,
    shell: process.env.SHELL || process.env.ComSpec || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    cwd: process.cwd(),
    uptimeSeconds: Math.round(os.uptime()),
  };
  emit(argv, data, () => {
    console.log(`${data.platform}/${data.arch} · ${data.osVersion}`);
    console.log(`node ${data.node} · ${data.cpu.cores}× ${data.cpu.model}`);
    console.log(`memory ${data.memory.freeGB}/${data.memory.totalGB} GB free`);
    console.log(`user ${data.user} · shell ${data.shell ?? '?'} · tz ${data.timezone}`);
    console.log(`cwd ${data.cwd}`);
  });
};

const sys = { command, describe, builder, handler };

export default sys;
