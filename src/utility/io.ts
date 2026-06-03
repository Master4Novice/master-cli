/**
 * Shared I/O for AI-agent-friendly AND human-friendly commands.
 *
 * Contract every command follows:
 *  - **Headless first**: runs from flags/stdin; an interactive prompt is only a
 *    fallback when stdout is a TTY and required input is missing.
 *  - **Machine-readable**: with `--json`, or whenever stdout is NOT a TTY (piped
 *    into an agent/file), the command prints exactly one JSON object to stdout:
 *    success → `{ "ok": true, ... }`, failure → `{ "ok": false, "error", "message" }`.
 *  - **Human-friendly**: on a TTY without `--json`, it renders the rich/coloured
 *    output instead.
 *  - **Stable exit codes**: `0` success, non-zero on failure.
 *
 * Logs/spinners/banners go to **stderr** (see Logger) so stdout stays a clean
 * data channel for agents.
 */

/** True when stdout is an interactive terminal. */
export const isTTY = (): boolean => Boolean(process.stdout.isTTY);

/** Add the standard `--json` option to a yargs builder. */
export const withJsonFlag = (yargs: any) =>
  yargs.option('json', {
    type: 'boolean',
    default: false,
    describe: 'Emit a single machine-readable JSON object on stdout',
  });

/** Should this invocation produce JSON? (explicit flag, or non-TTY stdout). */
export const wantsJson = (argv: { json?: boolean }): boolean =>
  Boolean(argv?.json) || !isTTY();

/** Write one line of JSON to stdout. */
const writeJson = (obj: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify(obj) + '\n');
};

/**
 * Emit a successful result. In JSON mode prints `{ ok: true, ...data }`;
 * otherwise calls `renderHuman` for the pretty output. Returns exit code 0.
 */
export function emit(
  argv: { json?: boolean },
  data: Record<string, unknown>,
  renderHuman: () => void,
): void {
  if (wantsJson(argv)) {
    writeJson({ ok: true, ...data });
  } else {
    renderHuman();
  }
}

/**
 * Emit a failure and exit with `code` (default 1). In JSON mode prints
 * `{ ok: false, error, message }` on stdout; otherwise logs the message to
 * stderr. Never returns.
 *
 * @param error   short stable machine code, e.g. `"InvalidInput"`.
 * @param message human-readable explanation.
 */
export function fail(
  argv: { json?: boolean },
  error: string,
  message: string,
  code = 1,
): never {
  if (wantsJson(argv)) {
    writeJson({ ok: false, error, message });
  } else {
    console.error(message);
  }
  process.exit(code);
}

/** True when a TTY-interactive fallback is appropriate (TTY and not --json). */
export const canPrompt = (argv: { json?: boolean }): boolean =>
  isTTY() && !argv?.json;

/**
 * Emit a `{ ok: false, error, message }` failure and exit, WITHOUT a parsed
 * argv. Used by the yargs `.fail()` handler, where errors originate in the
 * parser layer (missing required arg, unknown command/flag, coerce throw)
 * before a command's own `fail()` can run. JSON mode is inferred from
 * `--json` in argv or a non-TTY stdout. Never returns.
 */
export function failEnvelope(error: string, message: string, code = 2): never {
  const json = process.argv.includes('--json') || !isTTY();
  if (json) {
    process.stdout.write(JSON.stringify({ ok: false, error, message }) + '\n');
  } else {
    console.error(message);
  }
  process.exit(code);
}
