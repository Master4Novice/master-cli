# Security Policy

## Reporting a vulnerability

Please open a private report via
[GitHub Security Advisories](https://github.com/Master4Novice/master-cli/security/advisories/new)
rather than a public issue. You should receive a response within a week.

## Threat model & design guarantees

`mfn` is a local developer tool. It is designed so that untrusted *input*
(strings, tokens, file contents, port numbers) can never escalate into code
execution or unintended process termination:

- **No shell interpolation.** Every external process (`npm`, `lsof`, `netstat`,
  `kill`, `taskkill`) is spawned with `execFile` — arguments are passed as an
  array, never interpolated into a shell string. A crafted package name or port
  value cannot inject commands.
- **Strict input validation.** Ports must be integers in 1..65535; counts,
  sizes, and byte lengths have hard upper bounds; PIDs parsed from `lsof`/
  `netstat` output must be strictly numeric before being passed to `kill`.
- **JWTs are decoded, never verified or transmitted.** `mfn decode` performs
  local base64url decoding only; the token never leaves the machine, and the
  output explicitly states the signature is not verified.
- **Crypto uses Node's CSPRNG.** `random` and `id` use `node:crypto`
  (`randomBytes`, `randomUUID`) with rejection sampling — no `Math.random`, no
  modulo bias.
- **Local cache is private.** `~/.mfn/cache` (recent ports, ignore lists) is
  created with mode `0700`.
- **No network calls** except `mfn update`, which delegates to `npm` itself.
- **No telemetry.** Nothing is collected or sent anywhere.

## Scope notes

- `mfn hash` supports `md5`/`sha1` for checksum interop with legacy systems —
  they are not suitable for security purposes; use `sha256`/`sha512`.
- `mfn kill` sends `SIGKILL` to processes the invoking user owns; it cannot
  affect other users' processes beyond what the OS already permits.
- `mfn update <package>` installs a named package globally via npm — only point
  it at packages you trust, exactly as with `npm install -g`.

## Supported versions

Only the latest published major (3.x) receives security fixes.
