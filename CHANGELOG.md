# Changelog

All notable changes to `@master4n/master-cli` (`mfn`) are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] — 2026-06-05

Phase 1a — new zero-dependency primitive commands (all via `node:crypto`/`node:net`),
the boilerplate AI agents regenerate on every machine.

### Added

- **`id`** — generate UUID v4, time-ordered **UUID v7 (RFC 9562)**, or a URL-safe
  nano id (unbiased 64-char alphabet). `-t`, `-n`, `--size`.
- **`hash`** — md5/sha1/sha256/sha512 of a string, `--file`, or piped stdin;
  hex/base64/base64url digest.
- **`encode`** — base64 / base64url / hex / url, encode or `--decode`, text or stdin.
- **`random`** — cryptographically secure random bytes (hex/base64/base64url) or an
  unbiased `--password` (rejection sampling).
- **`port`** — find a free port (or `-n` several), or `--check` a specific one. Pairs
  with `kill`.
- **`decode`** now also reports `expiry: { exp, expired, expiresInSeconds }` when the
  JWT payload carries a numeric `exp`.

All new commands honor the existing contract (`--json`, stdout-only data, exit
0/1/2, errors via the JSON envelope) and are listed by `mfn capabilities` and the
banner automatically.

## [2.3.3] — 2026-06-03

First release from the standalone repository (migrated out of the
`Master4Novice/common` monorepo). Phase 0: make every existing command the best,
most secure, AI-friendly version of itself.

### Added

- **`mfn capabilities [--json]`** — a self-describing manifest of every command,
  for agent discovery, plus an `llms.txt` documenting the agent contract.
- **`--json` on every command** — machine-readable `{ ok, ... }` on stdout; rich
  human output (and interactive prompts) only on a TTY.
- Enriched `--help`/`-h` for every command (usage, described options, examples)
  and a root usage banner + epilogue pointing to `capabilities`/`llms.txt`.

### Changed

- **Time commands migrated to `@master4n/temporal-transformer` v2** (Luxon-backed;
  `yyyy-MM-dd` tokens; integer epochs). Dropped `moment`/`moment-timezone`.
- Commands are **headless-first**: they run from flags/stdin with stable exit
  codes (`0` ok / `1` error / `2` usage); logs and the banner go to **stderr** so
  stdout stays a clean data channel.
- The welcome banner now renders only on a TTY (never with `--json`), enriched
  with version/runtime, a live clock, the tool list, and a rotating tip.

### Removed

- The `md`, `hra`, `sr`, and `create @apollo:express` commands, plus their dead
  support code and unused dependencies.

### Fixed (Phase 0.1 — from an adversarial agent review, 76→91)

- **Command injection** in `update`/`kill`/`getLatestVersion` — all process calls
  use `execFile` (no shell).
- **`cts` crash** on a broken symlink / unreadable entry — now defensive, always
  emits valid JSON.
- **Parser-layer errors honor the contract** — `.strict()` + `.demandCommand()` +
  a `.fail()` handler emit the `{ ok:false, error, message }` envelope with exit 2
  for unknown commands/flags, missing args, and bad input.
- `sc` validates `--limit`/`--depth`; `epoch --from` shape parity (`relative`);
  `kill` is stateless in headless mode (no cached-port replay); `mfn --version`
  reports the real version.
