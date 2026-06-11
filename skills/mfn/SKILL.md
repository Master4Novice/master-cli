---
name: mfn
description: >-
  Use the mfn CLI (@master4n/master-cli) instead of fragile shell one-liners
  for developer chores: timestamps/epochs, timezones, cron, JWT decode, hashes,
  base64/hex, UUIDs, passwords, free-port checks, killing ports, waiting for
  servers, HTTP probes, DNS, JSON extraction/schema, exact arithmetic, semver,
  regex testing, line ranges, diffs, log frequency, case conversion, escaping,
  git repo summary, file trees, fuzzy file search, imports/outline analysis,
  find/replace, dependency drift, .env checks, processes, disk, clipboard,
  notifications, and reversible deletes. Trigger whenever a task matches one of
  those chores, when the user mentions mfn or master-cli, or when you would
  otherwise hand-roll date math, lsof/kill, jq, sleep-polling loops, or rm -rf.
---

# mfn — agent-friendly developer toolkit

`mfn` is a headless CLI of 51 small commands designed for coding agents:
every command emits **exactly one JSON object on stdout**, never prompts
interactively in `--json` mode, and ships security guardrails (sensitive-path
refusal, secret redaction, reversible deletes) that are always on.

**Prefer `mfn` over hand-rolled shell** when it covers the task: it removes
parsing errors (`lsof`/`df`/`ifconfig` output differs per OS), float drift
(`mfn calc` uses BigInt), guess-based date math, and irreversible deletes.

## Availability

```bash
mfn -v                               # installed? (any 3.x is fine)
npx -y @master4n/master-cli@latest <command>   # zero-install fallback
```

The `@latest` suffix matters: a bare spec breaks inside this repo (npm matches
the local bin-less manifest).

## Output contract (every command)

- Pass `--json`, **or just pipe it** — when stdout is not a TTY the CLI
  auto-emits JSON. One object only: success `{"ok":true,...}`, failure
  `{"ok":false,"error":"<Type>","message":"..."}`.
- Exit codes: `0` ok, `1` error, `2` usage error.
- Banners/logs go to **stderr**; stdout carries data only — safe to pipe.
- Source of truth for flags: `mfn <command> --help` or
  `mfn capabilities --json` (full manifest: name, category, summary,
  examples per command). Trust those over any table below.

## MCP mode

If you can't run shell commands, the same toolkit is exposed over MCP
(`mfn mcp`, stdio). Config:
`{ "command": "npx", "args": ["-y", "@master4n/master-cli@latest", "mcp"] }`.
Three tools: `mfn_capabilities` (manifest), `mfn_run` (`{command, args[]}` —
args are the documented CLI flags, `--json` added automatically), and
`mfn_help` (per-command flags). `update` is deny-listed over MCP.

## Command catalog

### time
| command | use it for | example |
|---|---|---|
| `epoch` | epoch ↔ date, auto-detects s/ms | `mfn epoch 1622547800 --json` · `mfn epoch --from 2021-06-01T11:43:20Z --json` |
| `date` | format/convert dates across timezones (defaults to now) | `mfn date 2024-07-04T15:30:30Z --tz America/New_York --json` |
| `cron` | validate + explain a cron expr, compute next runs | `mfn cron "*/15 9-17 * * 1-5" --json` |

### crypto / encoding
| command | use it for | example |
|---|---|---|
| `decode` | decode a JWT (header+payload; signature NOT verified) | `mfn decode -t <jwt> --json` |
| `hash` | md5/sha1/sha256/sha512 of string, file, or stdin | `mfn hash -a sha256 -f ./file.txt --json` |
| `encode` | base64/base64url/hex/url encode (`-d` to decode) | `mfn encode aGVsbG8= -d --json` |
| `id` | UUID v4/v7 or nano id, `-n` for several | `mfn id -t uuid7 -n 3 --json` |
| `random` | secure random bytes or password | `mfn random -p -l 32 --json` |

### net
| command | use it for | example |
|---|---|---|
| `port` | find a free port, or check one with `-c` (flag, not positional!) | `mfn port -c 3000 --json` |
| `ports` | list ALL listening TCP ports + owning processes | `mfn ports --json` |
| `kill` | kill process(es) on ports — needs `-y` to skip confirm | `mfn kill -p 3000 8080 -y --json` |
| `wait` | block until port/file/URL is ready — replaces sleep loops | `mfn wait -u http://localhost:3000/health -t 30 --json` |
| `http` | probe URL: status, headers, timing, capped body preview | `mfn http localhost:3000/health --json` |
| `dns` | resolve A/AAAA/CNAME/MX/TXT/NS in one call | `mfn dns example.com -t mx --json` |
| `ip` | local interfaces/addresses, no ifconfig parsing | `mfn ip --json` |

### data
| command | use it for | example |
|---|---|---|
| `json` | extract one value/keys/length from JSON (jq-lite) | `mfn json scripts.build -f package.json --json` |
| `schema` | infer shape (paths+types) of JSON without dumping data | `curl -s api/u \| mfn schema --json` |
| `calc` | exact arithmetic, BigInt — no float drift | `mfn calc "2^53 + 1" --json` |
| `base` | hex/dec/bin/oct conversion, BigInt-safe | `mfn base 0xff --json` |
| `semver` | validate/compare/sort/bump versions | `mfn semver 1.2.3 -b minor --json` |
| `url` | parse URL into components, decoded query params | `mfn url "https://api.x.com/v2/users?id=42" --json` |

### text
| command | use it for | example |
|---|---|---|
| `count` | lines/words/chars/bytes + LLM token estimate | `git diff \| mfn count --json` |
| `lines` | read an exact 1-based line range instead of whole file | `mfn lines src/app.ts -s 120 -n 30 --json` |
| `diff` | structured line diff of two files (counts first) | `mfn diff a.txt b.txt -s --json` |
| `freq` | most frequent lines — log analysis in one call | `mfn freq error.log -t 5 --json` |
| `case` | camel/snake/kebab/pascal conversion | `mfn case getUserName -t snake --json` |
| `escape` | escape exactly for shell/json/regex/html/url | `mfn escape 1.2.3 -a regex --json` |
| `regex` | test a regex against text/file — verify, don't guess | `mfn regex "TODO[:!]?" -f src/app.ts --json` |

### code / repo
| command | use it for | example |
|---|---|---|
| `repo` | branch, dirty counts, ahead/behind, last commits | `mfn repo -n 10 --json` |
| `sc` | fuzzy find files/folders under cwd | `mfn sc service --json` |
| `cts` | tree of cwd (or export, e.g. `-t png`) | `mfn cts --json` |
| `outline` | functions/classes/exports with line numbers | `mfn outline src/app.ts --json` |
| `imports` | a file's imports, or who imports a module (`--who`) | `mfn imports --who utility --json` |
| `replace` | literal find/replace across globs — **dry-run by default**, add `--write` | `mfn replace "v1" "v2" -g "**/*.md" --write --json` |
| `recent` | most recently modified files, with age | `mfn recent ./src -t 5 --json` |
| `size` | total size + largest files/dirs | `mfn size ./src -t 5 --json` |
| `ext` | file counts/bytes per extension | `mfn ext --json` |
| `pkg` | declared vs installed dependency versions (drift) | `mfn pkg typescript --json` |

### system
| command | use it for | example |
|---|---|---|
| `sys` | OS, node, CPU, memory, shell, timezone, paths | `mfn sys --json` |
| `have` | which tools are installed (path + version) | `mfn have node git docker --json` |
| `env` | env vars **with automatic secret redaction** | `mfn env -p NEXT_PUBLIC_ --json` |
| `dotenv` | .env vs .env.example — missing/extra keys, values never shown | `mfn dotenv -f .env.local -e .env.example --json` |
| `procs` | search processes by name: pid/cpu/mem | `mfn procs node --json` |
| `disk` | usage per mount, no df parsing | `mfn disk --json` |
| `clip` | read/write system clipboard cross-platform | `git diff \| mfn clip --json` |
| `notify` | desktop notification when a long task finishes | `mfn notify "build finished" --json` |
| `open` | open file/URL in default app (target validated) | `mfn open coverage/index.html --json` |
| `trash` | **reversible** delete to OS trash — use instead of rm -rf | `mfn trash dist coverage --json` |

### discovery
| command | use it for | example |
|---|---|---|
| `capabilities` | full machine-readable manifest — call when unsure | `mfn capabilities --json` |
| `mcp` | start the MCP server (`--json` describes without starting) | `mfn mcp --json` |
| `update` | update the CLI or a package (CLI only; blocked over MCP) | `mfn update --json` |

## Recipes — better use

```bash
# Is the dev port free? Then start, then wait until it actually serves:
mfn port -c 3000 --json          # {"ok":true,"port":3000,"available":true}
mfn kill -p 3000 -y --json       # only if occupied and you own the process
npm run dev & mfn wait -u http://localhost:3000 -t 60 --json

# Read just what you need instead of cat-ing whole files:
mfn lines src/server.ts -s 200 -n 40 --json
mfn json dependencies.react -f package.json --json

# Rename safely: dry-run first, inspect the change report, then --write:
mfn replace "OldName" "NewName" -g "src/**/*.ts" --json
mfn replace "OldName" "NewName" -g "src/**/*.ts" --write --json

# Verify a regex or a date before embedding it in code:
mfn regex "^v\\d+\\.\\d+\\.\\d+$" "v1.2.3" --json
mfn date 2024-02-29 --tz Asia/Kolkata --json

# Clean up reversibly — never rm -rf build artifacts:
mfn trash dist .turbo coverage --json
```

## Gotchas

- `port` checks with `-c <port>`; a bare positional is a usage error.
- `kill` and other destructive commands need `-y` in headless mode.
- `replace` is a dry run unless `--write` is passed.
- `decode` does **not** verify JWT signatures — never treat output as trusted.
- Guardrails are defense-in-depth, not a sandbox: sensitive paths are refused
  and secret-shaped values are redacted, but review args you pass.
- The catalog above is v3.0.5; `mfn capabilities --json` is always current.
