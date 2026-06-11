/**
 * `mfn mcp` — serve every mfn command over the Model Context Protocol (stdio).
 *
 * For agent clients that cannot run shell commands (MCP-only hosts). Protocol
 * loop lives in utility/mcp-server.ts; tool definitions and execution in
 * utility/mcp-tools.ts.
 *
 * Contract note: `mfn mcp --json` does NOT start the server — it emits the
 * usual single {ok,...} object describing the server and how to wire it. The
 * non-TTY auto-JSON rule is deliberately ignored here: an MCP client talks to
 * the server over pipes, which is exactly the non-TTY case.
 */
import { withJsonFlag, emit } from '../utility/io';
import { PROTOCOL_VERSION, serveMcp } from '../utility/mcp-server';
import { TOOLS, RUNNABLE, DENYLIST } from '../utility/mcp-tools';

const command = 'mcp';
const describe =
  'Serve every mfn command over the Model Context Protocol (stdio) — for MCP clients without shell access';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .example('mfn mcp', 'start the MCP server (stdio, JSON-RPC per line)')
    .example('mfn mcp --json', 'describe the server + client wiring (does not start it)');

const handler = async (argv: any) => {
  if (argv.json) {
    emit(
      argv,
      {
        transport: 'stdio',
        protocolVersion: PROTOCOL_VERSION,
        tools: TOOLS.map((t) => t.name),
        commands: RUNNABLE.length,
        denied: Object.keys(DENYLIST),
        clientConfig: {
          command: 'npx',
          args: ['-y', '@master4n/master-cli', 'mcp'],
        },
        note: 'Run `mfn mcp` (no flags) to start the server.',
      },
      () => undefined,
    );
    return;
  }
  await serveMcp();
};

const mcp = { command, describe, builder, handler };

export default mcp;
