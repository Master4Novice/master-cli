# Changelog

All notable changes to `@master4n/master-cli` (`mfn`) are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3] — 2026-06-10

The agent release: 30 new commands (13 → 43), ~6× faster startup, real quality
gates, security hardening, and category-grouped discovery.

### Added — 30 new commands

**Token savers** (extract instead of dump): `json` (path query), `schema`
(JSON shape inference), `count` (+ LLM token estimate), `lines` (exact ranges),
`outline` (symbols + line numbers), `diff` (structured hunks), `freq` (top
repeated lines), `imports` (import graph / reverse lookup), `repo` (one-shot git
summary), `sys`, `have`, `ip`, `size`, `ext`, `recent`, `ports` (all listeners),
`pkg` (declared vs installed), `env` (secrets always redacted), `dotenv`
(.env completeness; values never read).

**Exact computation** (hallucination killers): `calc` (BigInt-exact arithmetic,
hand-written parser — no eval), `base` (hex/dec/bin/oct), `semver`, `cron`
(validate + explain + next runs), `regex` (test, don't assume), `url`, `escape`
(shell/JSON/regex/HTML/URL), `case` (naming styles).

**Actions**: `replace` (multi-file literal find/replace, dry-run by default),
`wait` (block until port/URL/file ready), `http` (probe with capped body preview).

### Changed

- **~6× faster startup for headless/agent calls** (~0.4s → ~0.06s): sharp,
  inquirer, figlet, boxen, ora and the banner clock now lazy-load.
- `capabilities --json` gained `docs` (README + llms.txt URLs), `categories`,
  and a `category` per command; human output groups by category.
- README/llms.txt document the zero-install path (`npx -y @master4n/master-cli`)
  and the full 43-command agent contract.
- Quality gates are real now: ESLint 10 (flat config) + Prettier with CI
  enforcement, a 150-code-line cap per file, and a Windows CI leg exercising
  the netstat/where paths. Tests: 32 → 90, split per domain.
- Command registration is typed (`CliCommand`); catalog split into three
  category-tagged data modules.

### Fixed

- **`kill -p <bad-port>` now follows the exit-code contract** — `InvalidPort`/
  exit 2 (usage) instead of `CommandError`/exit 1; ports range-checked (1..65535).

### Security

- Added `SECURITY.md` (threat model, guarantees, reporting policy) — shipped
  inside the npm package.
- `kill` refuses non-numeric PIDs parsed from `lsof`/`netstat` output.
- `env` redacts secret-looking values unconditionally (no off switch);
  `dotenv` never reads values at all; `have` validates tool names against a
  strict charset before probing.
- `~/.mfn/cache` is created with mode `0700`.

### Changed

- **~6× faster startup for headless/agent calls.** All TTY-only and
  format-specific dependencies (`sharp`, `inquirer`, `figlet`, `boxen`, `ora`,
  and the banner's temporal-transformer clock) are now lazy-loaded, so a
  headless `mfn <cmd> --json` pays only for what it uses
  (~0.4s → ~0.06s per invocation on a warm cache).
- `capabilities --json` now includes a `docs` block pointing agents at the
  README and the raw `llms.txt` agent contract.
- README/llms.txt document the zero-install path:
  `npx -y @master4n/master-cli <cmd> --json`.
- Command registration is typed (`CliCommand` interface) instead of `any`.

### Fixed

- **`kill -p <bad-port>` now follows the exit-code contract.** An invalid or
  out-of-range port was thrown from the yargs coercer and surfaced as
  `CommandError`/exit 1; it is now `InvalidPort`/exit 2 (usage), and ports are
  range-checked (1..65535).

### Security

- Added `SECURITY.md` (threat model, guarantees, reporting policy) — also
  shipped inside the npm package.
- `kill` refuses non-numeric PIDs parsed from `lsof`/`netstat` output
  (defense-in-depth; prevents a parsing surprise becoming a stray `kill`
  argument such as `-1`).
- `~/.mfn/cache` is created with mode `0700` (recent-port history and ignore
  lists are user-private).

## [3.0.2] — 2026-06-06

Correctness + consistency from a cold-install review, plus discoverability.

### Fixed

- **`port -c` now probes both IPv4 and IPv6.** It bound only IPv6 `::`, so a port
  occupied by an IPv4-only listener (`app.listen(3000,'0.0.0.0')`) was wrongly
  reported `available:true`. It now bind-tests `0.0.0.0` **and** `::` and is free
  only if both are (an unsupported family is ignored).
- **Uniform exit codes for bad input.** `epoch`/`date`/`decode` validation errors
  (fractional/NaN epoch, unknown timezone, malformed JWT) now exit **2** (usage),
  matching `id`/`random`/`port` — previously exit 1.
- **`epoch ''`** (empty value) is now a usage error (`MissingInput`, exit 2)
  instead of silently resolving to epoch 0.

### Changed

- Discoverability: broadened keywords and added a "Part of the @master4n toolkit"
  section cross-linking the sibling packages.

## [3.0.1] — 2026-06-05

Phase 1 follow-up — close a boundary regression an adversarial review found in the
new primitives (score 88 → back into the low 90s).

### Fixed

- **`random` and `id` no longer crash on a huge value.** The two new *synchronous*
  handlers validated their lower bound but not the upper, so `random -b 2147483648`
  or `id -n 4294967296` overflowed `randomBytes`/`Array.from` and escaped as a raw
  stack trace with empty stdout (a sync throw bypasses the global `.fail()`). They
  now reject out-of-range values via the JSON envelope (`InvalidBytes`/`InvalidLength`/
  `InvalidCount`/`InvalidSize`, exit 2), matching their existing lower-bound checks.
  Caps: bytes ≤ 1 MiB, password/nano ≤ 4096, id count ≤ 100 000.
- **`encode --decode` rejects garbage** for byte codecs instead of silently
  returning `""` — invalid hex/base64/base64url now fails with `CodecError` (exit 1).
- **`port` output shape is stable** across counts: always `{ count, ports, port }`
  (previously `-n 1` returned only `{ port }`).

### Tooling

- Added boundary tests (the exact huge-input repros) so the crash class can't return.

## [3.0.0] — 2026-06-05

First release from the standalone repository (migrated out of the
`Master4Novice/common` monorepo) and a **major rewrite** of the CLI into an
AI-agent-friendly toolkit. Major because commands present in the last npm release
(`2.3.1`) were removed. (Consolidates the unpublished 2.3.3 / 2.4.0 / 2.4.1
development iterations.)

> **Upgrading from 2.3.1:** `2.3.1` is now tagged `legacy` on npm and deprecated.
> `npm i -g @master4n/master-cli` installs 3.x. The `md`, `hra`, `sr`, and
> `create @apollo:express` commands are gone; everything else is now headless +
> `--json`. See the README for the new command set and contract.

### Added — agent-friendly foundation

- **`mfn capabilities [--json]`** — a self-describing manifest of every command,
  plus an `llms.txt` documenting the agent contract.
- **`--json` on every command** — one machine-readable `{ ok, ... }` object on
  stdout; rich human output (and interactive prompts) only on a TTY.
- Headless-first execution, **stable exit codes** (`0` ok / `1` error / `2` usage),
  `.strict()` parsing (unknown command/flag → exit 2), logs/banner on **stderr**.
- Enriched `--help`/`-h` for every command (usage, options, examples); a banner
  with version/runtime, a live clock, the tool list, and a rotating tip.

### Added — new primitive commands (zero-dependency, via `node:crypto`/`node:net`)

- **`id`** — UUID v4, time-ordered **UUID v7 (RFC 9562)**, or URL-safe nano id.
- **`hash`** — md5/sha1/sha256/sha512 of a string, `--file`, or stdin.
- **`encode`** — base64 / base64url / hex / url, encode or `--decode`.
- **`random`** — secure random bytes, or an unbiased `--password`.
- **`port`** — find a free port (or `-n` several), or `--check` one. Pairs with `kill`.
- **`decode`** also reports `expiry: { exp, expired, expiresInSeconds }`.

### Changed

- **Time commands migrated to `@master4n/temporal-transformer` v2** (Luxon-backed;
  `yyyy-MM-dd` tokens; integer epochs). Dropped `moment`/`moment-timezone`.

### Removed

- The `md`, `hra`, `sr`, and `create @apollo:express` commands and their dead
  support code / unused dependencies.

### Fixed (hardened to 91/100 in an adversarial agent review)

- **Command injection** in `update`/`kill`/`getLatestVersion` — all process calls
  use `execFile` (no shell).
- **`cts` crash** on a broken symlink / unreadable entry — now always emits JSON.
- **Parser-layer errors honor the contract** — `.strict()` + `.demandCommand()` +
  a `.fail()` JSON envelope (exit 2) for unknown commands/flags and missing args.
- `sc` validates `--limit`/`--depth`; `epoch --from` shape parity (`relative`);
  `kill` stateless in headless mode; `mfn --version` reports the real version.

### Security

- Removed `inquirer-fuzzy-path` (bundled `inquirer@6` → `external-editor` →
  `tmp@0.0.33`). Runtime `npm audit` is now **0 vulnerabilities**.

### Tooling

- vitest suite (subprocess contract + unit tests) and CI (Node 20/22:
  typecheck → build → test → publish dry-run).
