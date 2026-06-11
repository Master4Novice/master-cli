import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { run, BIN } from './helpers';

/**
 * MCP server conformance: pipe a scripted JSON-RPC session into `mfn mcp`
 * (stdin closes after the script, so the server processes every line and
 * exits 0 — exactly how an MCP client disconnect behaves).
 */
function mcpSession(...messages: Record<string, unknown>[]): any[] {
  const input = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
  const stdout = execFileSync('node', [BIN, 'mcp'], { encoding: 'utf8', input });
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const initMsg = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 't', version: '1' },
  },
};

describe('mfn mcp — Model Context Protocol server (stdio)', () => {
  it('--json describes the server without starting it (CLI contract holds)', () => {
    const r = run('mcp', '--json');
    expect(r.code).toBe(0);
    expect(r.singleObject).toBe(true);
    expect(r.json.ok).toBe(true);
    expect(r.json.transport).toBe('stdio');
    expect(r.json.tools).toEqual(['mfn_capabilities', 'mfn_run', 'mfn_help']);
    expect(r.json.denied).toContain('update');
  });

  it('initialize → tools/list returns the three tools with schemas', () => {
    const [init, list] = mcpSession(initMsg, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(init.result.protocolVersion).toBe('2025-06-18');
    expect(init.result.serverInfo.name).toBe('@master4n/master-cli');
    expect(init.result.capabilities.tools).toBeDefined();
    const tools = list.result.tools;
    expect(tools.map((t: any) => t.name)).toEqual(['mfn_capabilities', 'mfn_run', 'mfn_help']);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('stdout carries only JSON-RPC lines (banner/logs stay on stderr)', () => {
    const lines = mcpSession(initMsg, { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.jsonrpc).toBe('2.0');
  });

  it('mfn_run executes a real command and returns its JSON envelope', () => {
    const [, call] = mcpSession(initMsg, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command: 'calc', args: ['2^64 + 1'] } },
    });
    expect(call.result.isError).toBe(false);
    expect(call.result.structuredContent.ok).toBe(true);
    expect(call.result.structuredContent.result).toBe('18446744073709551617');
  });

  it('mfn_capabilities returns the full manifest', () => {
    const [, call] = mcpSession(initMsg, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_capabilities', arguments: {} },
    });
    expect(call.result.isError).toBe(false);
    expect(call.result.structuredContent.commands.length).toBeGreaterThanOrEqual(50);
  });

  it('mfn_help returns usage text for a command', () => {
    const [, call] = mcpSession(initMsg, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_help', arguments: { command: 'epoch' } },
    });
    expect(call.result.isError).toBe(false);
    expect(call.result.content[0].text).toContain('epoch');
  });

  it('deny-lists update and mcp; rejects unknown commands', () => {
    const calls = ['update', 'mcp', 'no-such-cmd'].map((command, i) => ({
      jsonrpc: '2.0',
      id: i + 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command, args: [] } },
    }));
    const [, ...results] = mcpSession(initMsg, ...calls);
    for (const r of results) {
      expect(r.result.isError).toBe(true);
      expect(JSON.parse(r.result.content[0].text).ok).toBe(false);
    }
  });

  it('guardrails propagate through MCP (hash -f on a sensitive path refuses)', () => {
    const [, call] = mcpSession(initMsg, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command: 'hash', args: ['-f', '.env'] } },
    });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent.error).toBe('SensitivePath');
  });

  it('JSON-RPC errors: unknown tool, unknown method, parse error — then keeps serving', () => {
    const lines = mcpSession(
      initMsg,
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      { jsonrpc: '2.0', id: 3, method: 'no/such-method' },
      { jsonrpc: '2.0', id: 4, method: 'ping' },
    );
    expect(lines[1].error.code).toBe(-32602);
    expect(lines[2].error.code).toBe(-32601);
    expect(lines[3].result).toEqual({});
  });

  it('a malformed line gets -32700 and the session continues', () => {
    const input =
      JSON.stringify(initMsg) +
      '\nthis is not json\n' +
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) +
      '\n';
    const stdout = execFileSync('node', [BIN, 'mcp'], { encoding: 'utf8', input });
    const lines = stdout
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines[1].error.code).toBe(-32700);
    expect(lines[2].result).toEqual({});
  });

  it('caps abusive input (too many args)', () => {
    const [, call] = mcpSession(initMsg, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command: 'calc', args: Array(65).fill('1') } },
    });
    expect(call.result.isError).toBe(true);
  });
});
