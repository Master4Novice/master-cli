import { describe, it, expect } from 'vitest';
import { run, mcpSession, MCP_INIT } from './helpers';

/** MCP server conformance, part 1: protocol shape and the three tools. */
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
    const [init, list] = mcpSession(MCP_INIT, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
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
    const lines = mcpSession(MCP_INIT, { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.jsonrpc).toBe('2.0');
  });

  it('mfn_run executes a real command and returns its JSON envelope', () => {
    const [, call] = mcpSession(MCP_INIT, {
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
    const [, call] = mcpSession(MCP_INIT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_capabilities', arguments: {} },
    });
    expect(call.result.isError).toBe(false);
    expect(call.result.structuredContent.commands.length).toBeGreaterThanOrEqual(50);
  });

  it('mfn_help returns usage text for a command', () => {
    const [, call] = mcpSession(MCP_INIT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_help', arguments: { command: 'epoch' } },
    });
    expect(call.result.isError).toBe(false);
    expect(call.result.content[0].text).toContain('epoch');
  });
});
