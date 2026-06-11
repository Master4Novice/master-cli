/**
 * The Model Context Protocol stdio server loop behind `mfn mcp`: one JSON-RPC
 * 2.0 message per line on stdin/stdout. Hand-rolled on node built-ins — no SDK
 * dependency. Tool definitions and execution live in mcp-tools.ts.
 */
import { createInterface } from 'node:readline';
import { COMMANDS } from '../catalog';
import pkg from '../../package.json';
import { TOOLS, callTool } from './mcp-tools';

export const PROTOCOL_VERSION = '2025-06-18';

/** One line of JSON-RPC on stdout — the MCP stdio framing. */
const send = (msg: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify(msg) + '\n');
};

const reply = (id: unknown, result: Record<string, unknown>): void =>
  send({ jsonrpc: '2.0', id, result });

const replyError = (id: unknown, code: number, message: string): void =>
  send({ jsonrpc: '2.0', id, error: { code, message } });

async function handleMessage(msg: any): Promise<void> {
  const { id, method, params } = msg ?? {};
  const isRequest = id !== undefined && id !== null;

  if (typeof method !== 'string') {
    if (isRequest) replyError(id, -32600, 'Invalid request: no method');
    return;
  }
  if (method.startsWith('notifications/')) return; // initialized, cancelled, …

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      reply(id, {
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: pkg.name, version: pkg.version },
        instructions:
          `Wraps the mfn CLI (${COMMANDS.length} headless commands). Call mfn_capabilities ` +
          'first to discover commands, then mfn_run {command, args} to execute one — every ' +
          'result is a single JSON object ({ok:true,...} or {ok:false,error,message}). ' +
          'mfn_help returns per-command flags. Security guardrails (sensitive-path refusal, ' +
          'secret redaction, reversible deletes) are always on; `update` is not exposed.',
      });
      return;
    }
    case 'ping':
      reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: TOOLS });
      return;
    case 'tools/call': {
      const name = String(params?.name ?? '');
      if (!TOOLS.some((t) => t.name === name)) {
        replyError(id, -32602, `Unknown tool "${name}"`);
        return;
      }
      reply(id, await callTool(name, params?.arguments ?? {}));
      return;
    }
    default:
      if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
  }
}

/** Serve until stdin closes (client disconnect). Never returns. */
export async function serveMcp(): Promise<never> {
  process.stderr.write(`${pkg.name} v${pkg.version} — MCP server ready (stdio)\n`);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: any;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      replyError(null, -32700, 'Parse error: messages must be one JSON object per line');
      continue;
    }
    try {
      await handleMessage(msg);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replyError(msg?.id ?? null, -32603, `Internal error: ${message}`);
    }
  }
  process.exit(0); // stdin closed — client disconnected
}
