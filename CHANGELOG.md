# Changelog

All notable changes to `@master4n/master-cli` (`mfn`) are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
