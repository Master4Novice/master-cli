import { CLASSIC_COMMANDS } from './catalog.classic';
import { AGENT_COMMANDS } from './catalog.agent';
import { POWER_COMMANDS } from './catalog.power';
import { OS_COMMANDS } from './catalog.os';

/**
 * Single source of truth for the command catalogue — consumed by the welcome
 * banner (the "tools" line) and by `mfn capabilities` (the agent-facing
 * manifest). Add new commands to the matching catalog.*.ts data module.
 */
export interface CommandInfo {
  /** Invocation name, e.g. `epoch`. */
  name: string;
  /** Functional grouping an agent can filter on. */
  category: 'discovery' | 'time' | 'crypto' | 'text' | 'data' | 'code' | 'net' | 'system';
  /** One-line human summary. */
  summary: string;
  /** Copy-paste examples (headless, agent-friendly). */
  examples: string[];
}

export const COMMANDS: readonly CommandInfo[] = [
  ...CLASSIC_COMMANDS,
  ...AGENT_COMMANDS,
  ...POWER_COMMANDS,
  ...OS_COMMANDS,
] as const;

/** Distinct categories in catalogue order (for grouped rendering). */
export const CATEGORIES: readonly string[] = [...new Set(COMMANDS.map((c) => c.category))];
