/**
 * The three MCP tools `mfn mcp` exposes, and their execution. Every tool call
 * spawns this same binary with execFile (argument array, never a shell), so
 * all guardrails and the output contract apply unchanged. `update` is
 * deny-listed (an MCP-only client must not gain npm-install capability) and
 * `mcp` itself is deny-listed (no recursion).
 */
import { execFile } from 'node:child_process';
import { COMMANDS } from '../catalog';

const CALL_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 200_000;
/** Sanity caps on tool input — same spirit as the CLI's own input validation. */
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 10_000;

/** Commands an MCP client may not invoke. */
export const DENYLIST: Record<string, string> = {
  update: 'installs npm packages globally — not exposed to MCP clients',
  mcp: 'starting a server inside the server is never what you want',
};

export const RUNNABLE = COMMANDS.map((c) => c.name).filter((n) => !(n in DENYLIST));

export const TOOLS = [
  {
    name: 'mfn_capabilities',
    description:
      'Machine-readable manifest of every mfn command (name, category, summary, examples). ' +
      'Call this first to discover what mfn can do.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mfn_run',
    description:
      'Run one mfn command headlessly and return its single JSON result object. ' +
      '`command` is a name from mfn_capabilities (e.g. "epoch"); `args` are the ' +
      'documented CLI flags/positionals (e.g. ["1622547800"] or ["-f","data.json"]). ' +
      '`--json` is added automatically. Security guardrails are always on.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command name from mfn_capabilities',
          enum: RUNNABLE,
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'CLI arguments exactly as documented (flags and positionals)',
        },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },
  {
    name: 'mfn_help',
    description: 'Full --help text (flags, examples) for one mfn command.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command name from mfn_capabilities' },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },
];

/** Spawn this same binary (no shell) and capture { code, stdout }. */
const runSelf = (args: string[]): Promise<{ code: number; stdout: string }> =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      [process.argv[1], ...args],
      { timeout: CALL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error: any, stdout: string) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ code, stdout: String(stdout ?? '') });
      },
    );
  });

/** MCP tool result envelope: text content + isError, structured when parseable. */
const toolResult = (text: string, isError: boolean): Record<string, unknown> => {
  const capped =
    text.length > MAX_OUTPUT_CHARS
      ? text.slice(0, MAX_OUTPUT_CHARS) + `\n[truncated at ${MAX_OUTPUT_CHARS} chars]`
      : text;
  const result: Record<string, unknown> = {
    content: [{ type: 'text', text: capped }],
    isError,
  };
  try {
    const parsed = JSON.parse(capped);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      result.structuredContent = parsed;
    }
  } catch {
    /* non-JSON output (e.g. help text) — text content alone is fine */
  }
  return result;
};

const toolError = (message: string): Record<string, unknown> => ({
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'McpToolError', message }) }],
  isError: true,
});

export async function callTool(name: string, input: any): Promise<Record<string, unknown>> {
  if (name === 'mfn_capabilities') {
    const r = await runSelf(['capabilities', '--json']);
    return toolResult(r.stdout.trim(), r.code !== 0);
  }

  if (name === 'mfn_help') {
    const command = String(input?.command ?? '');
    if (!COMMANDS.some((c) => c.name === command)) {
      return toolError(`Unknown command "${command}". Call mfn_capabilities for the list.`);
    }
    const r = await runSelf([command, '--help']);
    return toolResult(r.stdout.trim(), r.code !== 0);
  }

  if (name === 'mfn_run') {
    const command = String(input?.command ?? '');
    if (command in DENYLIST) {
      return toolError(`"${command}" is not available over MCP: ${DENYLIST[command]}.`);
    }
    if (!COMMANDS.some((c) => c.name === command)) {
      return toolError(`Unknown command "${command}". Call mfn_capabilities for the list.`);
    }
    const rawArgs = input?.args ?? [];
    if (!Array.isArray(rawArgs) || rawArgs.length > MAX_ARGS) {
      return toolError(`"args" must be an array of at most ${MAX_ARGS} strings.`);
    }
    const args = rawArgs.map(String);
    if (args.some((a) => a.length > MAX_ARG_LENGTH || a.includes('\0'))) {
      return toolError(`Each argument must be under ${MAX_ARG_LENGTH} chars with no NUL bytes.`);
    }
    const r = await runSelf([command, ...args, '--json']);
    const out = r.stdout.trim();
    if (!out) {
      return toolError(`"${command}" produced no output (exit ${r.code}).`);
    }
    return toolResult(out, r.code !== 0);
  }

  return toolError(`Unknown tool "${name}".`);
}
