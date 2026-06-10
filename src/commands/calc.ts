import { withJsonFlag, emit, fail } from '../utility/io';

/**
 * Safe arithmetic evaluator — a tiny recursive-descent parser, NOT eval().
 * Grammar: expr := term (('+'|'-') term)* ; term := factor (('*'|'/'|'%') factor)* ;
 * factor := unary ('^' factor)? ; unary := '-'? atom ; atom := number | '(' expr ')'.
 * Integer-only expressions (no '/', no decimals) are computed in BigInt, so
 * results beyond 2^53 are exact — the kind of math agents get subtly wrong.
 */
type Num = { big: bigint | null; float: number };

const MAX_EXPR = 1000;
const MAX_POW = 4096n;

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parse(): Num {
    const v = this.expr();
    this.skipWs();
    if (this.i < this.s.length)
      throw new Error(`Unexpected "${this.s[this.i]}" at position ${this.i}`);
    return v;
  }

  private skipWs() {
    while (this.s[this.i] === ' ') this.i++;
  }
  private peek(): string {
    this.skipWs();
    return this.s[this.i] ?? '';
  }

  private expr(): Num {
    let left = this.term();
    for (let op = this.peek(); op === '+' || op === '-'; op = this.peek()) {
      this.i++;
      left = combine(left, this.term(), op);
    }
    return left;
  }

  private term(): Num {
    let left = this.factor();
    for (let op = this.peek(); op === '*' || op === '/' || op === '%'; op = this.peek()) {
      this.i++;
      left = combine(left, this.factor(), op);
    }
    return left;
  }

  private factor(): Num {
    const base = this.unary();
    if (this.peek() === '^') {
      this.i++;
      return combine(base, this.factor(), '^'); // right-associative
    }
    return base;
  }

  private unary(): Num {
    if (this.peek() === '-') {
      this.i++;
      const v = this.unary();
      return { big: v.big === null ? null : -v.big, float: -v.float };
    }
    return this.atom();
  }

  private atom(): Num {
    if (this.peek() === '(') {
      this.i++;
      const v = this.expr();
      if (this.peek() !== ')') throw new Error('Missing closing parenthesis');
      this.i++;
      return v;
    }
    this.skipWs();
    const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`Expected a number at position ${this.i}`);
    this.i += m[0].length;
    const isInt = !m[1] && !m[2];
    return { big: isInt ? BigInt(m[0]) : null, float: Number(m[0]) };
  }
}

function combine(a: Num, b: Num, op: string): Num {
  const f =
    op === '+'
      ? a.float + b.float
      : op === '-'
        ? a.float - b.float
        : op === '*'
          ? a.float * b.float
          : op === '/'
            ? a.float / b.float
            : op === '%'
              ? a.float % b.float
              : Math.pow(a.float, b.float);
  if (op === '/' && b.float === 0) throw new Error('Division by zero');
  if (a.big === null || b.big === null || op === '/') return { big: null, float: f };
  if (op === '^') {
    if (b.big < 0n) return { big: null, float: f };
    if (b.big > MAX_POW) throw new Error(`Exponent too large (max ${MAX_POW})`);
    return { big: a.big ** b.big, float: f };
  }
  if (op === '%' && b.big === 0n) throw new Error('Modulo by zero');
  const big =
    op === '+'
      ? a.big + b.big
      : op === '-'
        ? a.big - b.big
        : op === '*'
          ? a.big * b.big
          : a.big % b.big;
  return { big, float: f };
}

const command = 'calc <expression>';
const describe = 'Exact arithmetic (+ - * / % ^, parens; integers use BigInt — no float drift)';

const builder = (yargs: any) =>
  withJsonFlag(yargs)
    .positional('expression', {
      describe: 'Expression, e.g. "2^64 - 1" or "(3 + 4) * 5"',
      type: 'string',
    })
    .example('mfn calc "2^53 + 1" --json', 'exact: 9007199254740993 (floats get this wrong)')
    .example('mfn calc "1729 * 4096 % 7" --json', 'integer arithmetic stays exact');

const handler = (argv: any) => {
  const expression = String(argv.expression).trim();
  if (!expression) return fail(argv, 'MissingInput', 'Provide an arithmetic expression.', 2);
  if (expression.length > MAX_EXPR) {
    return fail(argv, 'ExpressionTooLong', `Expression exceeds ${MAX_EXPR} characters.`, 2);
  }
  let value: Num;
  try {
    value = new Parser(expression).parse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(argv, 'ParseError', `Could not evaluate "${expression}": ${message}`, 2);
  }
  const exact = value.big !== null;
  const result = exact ? value.big!.toString() : String(value.float);
  emit(argv, { expression, result, exact, float: value.float }, () => console.log(result));
};

const calc = { command, describe, builder, handler };

export default calc;
