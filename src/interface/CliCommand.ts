/**
 * Shape every command module exports and `src/index.ts` registers. Typing the
 * registration (instead of `any`) means a malformed command module fails the
 * typecheck instead of failing at runtime.
 */
export interface CliCommand {
  /** yargs command spec, e.g. `epoch <value>` or `sc [pattern]`. */
  command: string;
  /** One-line description shown in `mfn -h`. */
  describe: string;
  /** yargs builder adding the command's options/examples. */
  builder: (yargs: any) => any;
  /** Command implementation; receives parsed argv. */
  handler: (argv: any) => void | Promise<void>;
}
