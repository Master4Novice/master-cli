import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { BIN, mcpSession, MCP_INIT } from './helpers';

/** MCP server conformance, part 2: errors, guardrails, abuse caps, concurrency. */
describe('mfn mcp — deny-list and guardrails', () => {
  it('deny-lists update and mcp; rejects unknown commands', () => {
    const calls = ['update', 'mcp', 'no-such-cmd'].map((command, i) => ({
      jsonrpc: '2.0',
      id: i + 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command, args: [] } },
    }));
    const [, ...results] = mcpSession(MCP_INIT, ...calls);
    for (const r of results) {
      expect(r.result.isError).toBe(true);
      expect(JSON.parse(r.result.content[0].text).ok).toBe(false);
    }
  });

  it('guardrails propagate through MCP (hash -f on a sensitive path refuses)', () => {
    const [, call] = mcpSession(MCP_INIT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command: 'hash', args: ['-f', '.env'] } },
    });
    expect(call.result.isError).toBe(true);
    expect(call.result.structuredContent.error).toBe('SensitivePath');
  });

  it('caps abusive input (too many args)', () => {
    const [, call] = mcpSession(MCP_INIT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mfn_run', arguments: { command: 'calc', args: Array(65).fill('1') } },
    });
    expect(call.result.isError).toBe(true);
  });
});

describe('mfn mcp — JSON-RPC errors and concurrency', () => {
  it('unknown tool, unknown method, then keeps serving', () => {
    const lines = mcpSession(
      MCP_INIT,
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
      JSON.stringify(MCP_INIT) +
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

  it('a slow tool call does not block requests behind it (concurrent handling)', () => {
    // `wait -f` on a file that never appears blocks for its full 2s timeout;
    // the ping sent AFTER it must still be answered first.
    const lines = mcpSession(
      MCP_INIT,
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'mfn_run',
          arguments: { command: 'wait', args: ['-f', '/tmp/mfn-never-exists-i8s2k', '-t', '2'] },
        },
      },
      { jsonrpc: '2.0', id: 3, method: 'ping' },
    );
    const order = lines.map((l) => l.id);
    expect(order.indexOf(3)).toBeLessThan(order.indexOf(2));
    const waitReply = lines.find((l) => l.id === 2);
    expect(waitReply.result.isError).toBe(true); // timed out, with a clean envelope
  });
});
