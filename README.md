# @master4n/master-cli (`mfn`)

[![CI](https://github.com/Master4Novice/master-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/master-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40master4n%2Fmaster-cli)](https://www.npmjs.com/package/@master4n/master-cli)
![npm downloads](https://img.shields.io/npm/dm/%40master4n%2Fmaster-cli)
![License](https://img.shields.io/npm/l/%40master4n%2Fmaster-cli)
![Owner](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)

**Master CLI for developers and AI agents.** A set of headless, JSON-first
commands that replace the boilerplate agents otherwise regenerate on every
machine — timestamp/date conversion, JWT decoding, freeing ports, finding files,
and directory trees. Every command runs the same for a human at a terminal and
for an agent reading stdout.

## Installation

```sh
npm install -g @master4n/master-cli
```

This installs the `mfn` command.

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

## Quick start

```sh
mfn -h                 # top-level help (lists every command)
mfn <command> -h       # per-command help: flags + examples
mfn -v                 # version
mfn capabilities --json   # machine-readable manifest of all commands
```

## Commands

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `capabilities` | Self-describing manifest of every command | `mfn capabilities --json` |
| `epoch` | Convert between epoch timestamps and dates (auto-detects s/ms/µs/ns) | `mfn epoch 1622547800 --json` · `mfn epoch --from 2021-06-01T11:43:20Z --json` |
| `date` | Convert/format a date across timezones (defaults to now) | `mfn date 2024-07-04T15:30:30Z --tz America/New_York --json` |
| `decode` | Decode a JWT (header + payload; signature **not** verified) | `mfn decode -t <jwt> --json` |
| `kill` | Kill the process(es) listening on given ports | `mfn kill -p 3000 8080 -y --json` |
| `sc` | Fuzzy-find files/folders under the current directory | `mfn sc service --json` |
| `cts` | Print (or export) a tree of the current directory | `mfn cts --json` · `mfn cts -t png` |
| `update` | Update the CLI (or a named package) to the latest version | `mfn update --json` |

Run `mfn <command> --help` for the full flag list and more examples.

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

## License

MIT © [Master4Novice](https://github.com/Master4Novice)
