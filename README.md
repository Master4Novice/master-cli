# @master4n/master-cli (`mfn`)

[![CI](https://github.com/Master4Novice/master-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/master-cli/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Master4Novice/master-cli/actions/workflows/codeql.yml/badge.svg)](https://github.com/Master4Novice/master-cli/actions/workflows/codeql.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Master4Novice/master-cli/badge.svg)](https://snyk.io/test/github/Master4Novice/master-cli)
[![Socket](https://socket.dev/api/badge/npm/package/@master4n/master-cli)](https://socket.dev/npm/package/@master4n/master-cli)
[![npm version](https://img.shields.io/npm/v/%40master4n%2Fmaster-cli)](https://www.npmjs.com/package/@master4n/master-cli)
![npm downloads](https://img.shields.io/npm/dm/%40master4n%2Fmaster-cli)
![License](https://img.shields.io/npm/l/%40master4n%2Fmaster-cli)
![Owner](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)

**Master CLI for developers and AI agents.** 51 headless, JSON-first commands in
three families: **token savers** (extract exactly what you need — one JSON field,
a line range, a file outline — instead of dumping whole files into context),
**exact computation** (BigInt math, semver, cron, regex, timezones — verified
answers instead of guesses), and **one-call actions** (free a port, wait for a
server, bulk-replace with dry-run). Every command runs the same for a human at a
terminal and for an agent reading stdout, in ~60ms.

## Installation

```sh
npm install -g @master4n/master-cli
```

This installs the `mfn` command.

### Zero-install (agents & one-off use)

No global install needed — `npx` runs any command directly:

```sh
npx -y @master4n/master-cli capabilities --json   # discover every command
npx -y @master4n/master-cli epoch 1622547800 --json
```

> **For AI agents:** run `mfn capabilities --json` (or the npx form above) to get
> the machine-readable manifest, and read [`llms.txt`](./llms.txt) — it ships
> inside the npm package and documents the full agent contract.

## The contract (why it's agent-friendly)

- **Headless-first** — every command runs from flags/stdin. Interactive prompts
  appear only on a TTY when required input is missing; with `--json` or when
  piped, commands never block.
- **Machine-readable** — pass `--json` (or just pipe; non-TTY auto-emits) and you
  get exactly one JSON object on stdout: `{ "ok": true, ... }` on success,
  `{ "ok": false, "error", "message" }` on failure.
- **Stable exit codes** — `0` success · `1` runtime error · `2` usage error.
- **Clean channels** — the banner, spinners, and logs go to **stderr**; stdout
  carries only data, so `mfn <cmd> --json | jq` always works.
- **Strict parsing** — unknown commands/flags and missing args fail loudly
  (`{ok:false}`, exit 2), never a silent "success".
- **Self-describing** — `mfn capabilities --json` lists every command, and
  [`llms.txt`](./llms.txt) documents the full agent contract.

## MCP server (built in)

For agent clients that can't run shell commands, `mfn mcp` serves the whole
toolkit over the [Model Context Protocol](https://modelcontextprotocol.io)
(stdio transport, zero extra dependencies):

```jsonc
// e.g. .mcp.json / claude_desktop_config.json / any MCP client
{
  "mcpServers": {
    "mfn": { "command": "npx", "args": ["-y", "@master4n/master-cli@latest", "mcp"] }
  }
}
```

Three tools: `mfn_capabilities` (the manifest), `mfn_run` (`{command, args[]}` —
runs any catalogued command and returns its single JSON object, guardrails
included), and `mfn_help` (per-command flags). `update` is deny-listed so an
MCP-only client can never install packages. `mfn mcp --json` describes the
server without starting it.

This repo ships a [`.mcp.json`](./.mcp.json) with exactly this wiring, so
cloning it gives Claude Code (and any client honouring project-scope MCP
config) the `mfn` server automatically.

## Quick start

```sh
mfn -h                 # top-level help (lists every command)
mfn <command> -h       # per-command help: flags + examples
mfn -v                 # version
mfn capabilities --json   # machine-readable manifest of all commands
```

## Commands (51)

Run `mfn capabilities` for the grouped list, `mfn <command> --help` for flags.

### OS-level — one call on macOS, Windows, and Linux

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `clip` | Read/write the system clipboard | `git diff \| mfn clip --json` |
| `notify` | Desktop notification — ping the user when a task finishes | `mfn notify "build finished" --json` |
| `open` | Open a file/URL in the default app (validated first) | `mfn open coverage/index.html --json` |
| `procs` | Search processes by name: pid/cpu/mem | `mfn procs node --json` |
| `disk` | Per-mount disk usage without df parsing | `mfn disk --json` |
| `trash` | **Reversible** delete to the OS trash — never `rm -rf` | `mfn trash old-logs --json` |
| `dns` | A/AAAA/CNAME/MX/TXT/NS in one call | `mfn dns github.com --json` |

### Token savers — read less, extract exactly

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `json` | One value from JSON by path — don't read the document | `mfn json scripts.build -f package.json --json` |
| `schema` | Infer JSON shape (paths + types); 10MB payload → ~20 lines | `mfn schema -f response.json --json` |
| `count` | Lines/words/chars/bytes + **LLM token estimate** | `git diff \| mfn count --json` |
| `lines` | Exact line range of a file (1-based), never the whole file | `mfn lines src/app.ts -s 120 -n 30 --json` |
| `outline` | Symbols + line numbers (.ts .js .py .go .md) | `mfn outline src/app.ts --json` |
| `diff` | Structured hunks of two files, counts first | `mfn diff old.json new.json -s --json` |
| `freq` | Most repeated lines — log triage in one call | `mfn freq error.log -t 5 --json` |
| `imports` | A file's imports, or who imports a module | `mfn imports --who utility --json` |
| `repo` | Git branch/dirty/ahead-behind/commits in one object | `mfn repo --json` |
| `sys` / `have` / `ip` | System facts · tool versions · local addresses | `mfn have node git docker --json` |
| `size` / `ext` / `recent` | Disk usage · composition by extension · newest files | `mfn size -t 5 --json` |
| `ports` | ALL listening TCP ports with owning processes | `mfn ports --json` |
| `pkg` | Declared vs installed dependency versions | `mfn pkg --json` |
| `env` / `dotenv` | Env inspection (secrets **always** redacted) · .env completeness | `mfn dotenv --json` |

### Exact computation — never guess

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `calc` | BigInt-exact arithmetic — `2^53 + 1` comes out right | `mfn calc "2^53 + 1" --json` |
| `base` | hex/dec/bin/oct conversion, BigInt-safe | `mfn base 0xff --json` |
| `semver` | Validate/compare/sort/bump per semver.org | `mfn semver 1.10.0 1.9.2 --json` |
| `cron` | Validate + explain + next run times | `mfn cron "*/15 9-17 * * 1-5" --json` |
| `regex` | Test a pattern — matches with line/index/groups | `mfn regex "TODO" -f src/app.ts --json` |
| `url` | URL → components + decoded query params | `mfn url "https://x.com/a?b=1" --json` |
| `escape` | Context-exact escaping: shell, JSON, regex, HTML, URL | `mfn escape "it's" --json` |
| `case` | camel/snake/kebab/pascal/… conversion | `mfn case getUserName -t snake --json` |
| `epoch` / `date` | Epoch ↔ date (auto unit) · timezone conversion | `mfn epoch 1622547800 --json` |
| `decode` | JWT header + payload + expiry (signature not verified) | `mfn decode -t <jwt> --json` |

### Actions — do, don't script

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `replace` | Literal find/replace across files — **dry-run by default** | `mfn replace old new -g "src/**/*.ts" --json` |
| `wait` | Block until port/URL/file is ready — no sleep loops | `mfn wait -p 3000 -t 30 --json` |
| `kill` | Free the ports your dev server got stuck on | `mfn kill -p 3000 8080 -y --json` |
| `http` | Probe a URL: status/headers/timing, capped body preview | `mfn http localhost:3000/health --json` |
| `port` | Find a free port, or check one | `mfn port -c 3000 --json` |
| `id` / `hash` / `encode` / `random` | UUID v4/v7/nano · digests · codecs · CSPRNG | `mfn id -t uuid7 -n 3 --json` |
| `sc` / `cts` | Fuzzy file find · directory tree | `mfn sc service --json` |
| `capabilities` / `update` | Machine-readable manifest · self-update | `mfn capabilities --json` |
| `mcp` | Serve every command over the Model Context Protocol (stdio) | `mfn mcp` |

### Examples

```sh
# Timestamps: any unit in, readable date out (parse cleanly in a script)
mfn epoch 1622547800000 --json | jq -r '.utc'        # 2021-06-01 11:43:20.000

# Free the ports your dev server got stuck on
mfn kill -p 3000 5173 -y --json

# Inspect a JWT without a website
mfn decode -t "$TOKEN" --json | jq '.payload.exp'

# Hand an agent the repo layout
mfn cts --json | jq -r '.tree'
```

## Notes

- Date/time features are powered by
  [`@master4n/temporal-transformer`](https://www.npmjs.com/package/@master4n/temporal-transformer)
  v2 (Luxon-backed, integer epochs, `yyyy-MM-dd HH:mm:ss` tokens).
- Process/port/package operations use `execFile` (no shell), so inputs cannot
  inject commands.

## Part of the @master4n toolkit

A small ecosystem of focused, agent-friendly packages:

- [`@master4n/temporal-transformer`](https://www.npmjs.com/package/@master4n/temporal-transformer) — epoch/timestamp ↔ date conversion with auto unit-detection and IANA timezones (Luxon-backed)
- [`@master4n/temporal-transformer-codemod`](https://www.npmjs.com/package/@master4n/temporal-transformer-codemod) — codemod to migrate temporal-transformer v1→v2
- [`@master4n/http-status`](https://www.npmjs.com/package/@master4n/http-status) — machine-readable HTTP status-code registry for apps & AI agents
- [`@master4n/decorators`](https://www.npmjs.com/package/@master4n/decorators) — zero-dependency TypeScript decorators (DI, validation, resilience, redaction)

## License

MIT © [Master4Novice](https://github.com/Master4Novice)
