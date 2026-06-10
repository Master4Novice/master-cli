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

## Guardrails (active, no override flags)

`mfn` is built to be safe to hand to an AI agent. These guardrails are always
on — there are deliberately **no bypass flags**, because an agent will find and
use any flag that exists:

| Guardrail | Commands | What it prevents |
| --------- | -------- | ---------------- |
| **Sensitive-path refusal** (`SensitivePath`, exit 2) | `lines` `json` `schema` `diff` `freq` `regex -f` | Returning the CONTENT of credential stores: `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.kube`, `.env*`, `*.pem`, `*.key`, `id_rsa*`, `.npmrc`, `.netrc`, `shadow`, … An agent's context window is a log that never rotates. |
| **Clipboard secret redaction** | `clip` (read) | Passwords/tokens pasted through the clipboard (password managers). Secret-shaped content (private-key blocks, JWTs, AWS/GitHub/Slack/Google/npm/`sk-` tokens) is withheld with `redacted:true`. |
| **Env value scanning** | `env` | Redacts by NAME pattern (key/token/secret/…) **and** by VALUE shape — an innocently named variable holding a JWT is still redacted. `mfn env` with no names lists names only. |
| **Dotenv never reads values** | `dotenv` | Compares KEY presence between `.env` and `.env.example`; values are never parsed, stored, or returned. |
| **Cloud-metadata block** (`BlockedTarget`, exit 2) | `http` `wait -u` | SSRF credential theft via `169.254.169.254`, `metadata.google.internal`, Alibaba/AWS v6 endpoints. Localhost stays allowed — probing your own dev server is the point. |
| **Session-cookie redaction** | `http` | `set-cookie` response headers are replaced with `[redacted: session cookie]`. |
| **Scheme allow-list** | `open` | Only http(s) URLs or existing local paths; `javascript:`, `file:`, and custom protocol handlers are refused. |
| **Reversible delete only** | `trash` | Moves to the OS trash (never unlink); refuses `/`, home, cwd, and any parent of cwd — compared by realpath so symlinks can't fool it. |
| **PID floor + numeric check** | `kill` | A parsing surprise can never become `kill -9 0/1/-1`; ports validated 1..65535. |
| **Tool-name charset** | `have` | Probed names must be plain command names — no paths, no metacharacters. |
| **Dry-run by default** | `replace` | File modification requires explicit `--write`; scope is bounded to cwd. |
| **Body/range caps everywhere** | `http` (2KB preview) `lines` (2000) `diff` (20k lines) `clip` (1MB) … | One call can never flood a context window or memory. |

## Scope notes

- `mfn hash` supports `md5`/`sha1` for checksum interop with legacy systems —
  they are not suitable for security purposes; use `sha256`/`sha512`.
- `mfn kill` sends `SIGKILL` to processes the invoking user owns; it cannot
  affect other users' processes beyond what the OS already permits.
- `mfn update <package>` installs a named package globally via npm — only point
  it at packages you trust, exactly as with `npm install -g`.

## Supported versions

Only the latest published major (3.x) receives security fixes.
