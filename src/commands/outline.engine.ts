/**
 * Regex-based source outliner. Not a real parser — it's the 95% answer in
 * ~zero time: top-level symbols with line numbers, so an agent can read a
 * 50-token outline and then fetch only the lines it needs (`mfn lines`).
 */
export interface Symbol {
  line: number;
  kind: string;
  name: string;
  exported: boolean;
}

interface Rule {
  kind: string;
  re: RegExp;
}

const TS_RULES: Rule[] = [
  {
    kind: 'function',
    re: /^(?<exp>export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(?<name>[A-Za-z_$][\w$]*)/,
  },
  {
    kind: 'class',
    re: /^(?<exp>export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(?<name>[A-Za-z_$][\w$]*)/,
  },
  { kind: 'interface', re: /^(?<exp>export\s+)?interface\s+(?<name>[A-Za-z_$][\w$]*)/ },
  { kind: 'type', re: /^(?<exp>export\s+)?type\s+(?<name>[A-Za-z_$][\w$]*)\s*=/ },
  { kind: 'enum', re: /^(?<exp>export\s+)?(?:const\s+)?enum\s+(?<name>[A-Za-z_$][\w$]*)/ },
  {
    kind: 'const',
    re: /^(?<exp>export\s+)?const\s+(?<name>[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
  },
  { kind: 'variable', re: /^(?<exp>export\s+)(?:const|let|var)\s+(?<name>[A-Za-z_$][\w$]*)/ },
];

const PY_RULES: Rule[] = [
  { kind: 'function', re: /^(?:async\s+)?def\s+(?<name>[A-Za-z_][\w]*)/ },
  { kind: 'class', re: /^class\s+(?<name>[A-Za-z_][\w]*)/ },
];

const GO_RULES: Rule[] = [
  { kind: 'function', re: /^func\s+(?:\([^)]+\)\s+)?(?<name>[A-Za-z_][\w]*)/ },
  { kind: 'type', re: /^type\s+(?<name>[A-Za-z_][\w]*)/ },
];

const MD_RULES: Rule[] = [{ kind: 'heading', re: /^(?<name>#{1,6}\s+.+)$/ }];

const RULES_BY_EXT: Record<string, Rule[]> = {
  '.ts': TS_RULES,
  '.tsx': TS_RULES,
  '.js': TS_RULES,
  '.jsx': TS_RULES,
  '.mjs': TS_RULES,
  '.cjs': TS_RULES,
  '.py': PY_RULES,
  '.go': GO_RULES,
  '.md': MD_RULES,
  '.markdown': MD_RULES,
};

export const SUPPORTED_EXTENSIONS = Object.keys(RULES_BY_EXT);

export function outline(text: string, extension: string): Symbol[] {
  const rules = RULES_BY_EXT[extension.toLowerCase()];
  if (!rules) return [];
  const symbols: Symbol[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Indented lines are methods/nested scopes for TS/Go/MD; Python methods
    // (indented defs) are still worth surfacing, so allow indent there.
    const raw = lines[i];
    const line = rules === PY_RULES ? raw.trimStart() : raw;
    for (const rule of rules) {
      const m = rule.re.exec(line);
      if (m?.groups?.name) {
        symbols.push({
          line: i + 1,
          kind: rule.kind,
          name: m.groups.name.trim(),
          exported: Boolean(m.groups.exp) || rules !== TS_RULES,
        });
        break;
      }
    }
  }
  return symbols;
}
