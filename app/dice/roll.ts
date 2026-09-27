import { formatDice, parseDice, type DiceExpression, type Term } from "./parse";
import type { Rng } from "./rng";

/** Advantage and disadvantage apply to d20s: each is rolled twice, keeping the higher or lower. */
export type RollMode = "normal" | "advantage" | "disadvantage";

export interface DieRoll {
  sides: number;
  value: number;
  /** False for the discarded die of an advantage/disadvantage pair. */
  kept: boolean;
}

export interface TermResult {
  term: Term;
  rolls: DieRoll[];
  /** Signed contribution to the total. */
  subtotal: number;
}

export interface RollResult {
  /** Canonical form of what was rolled, e.g. `1d20 + 3`. */
  expression: string;
  mode: RollMode;
  total: number;
  terms: TermResult[];
  /** A natural 20 or 1, when exactly one d20 counted (an attack roll, check or save). */
  natural?: 20 | 1;
}

export function roll(expression: DiceExpression, rng: Rng, mode: RollMode = "normal"): RollResult {
  const terms = expression.terms.map((term): TermResult => {
    if (term.kind === "constant") return { term, rolls: [], subtotal: term.value };
    const rolls = Array.from({ length: term.count }, () => rollOne(term.sides, rng, mode)).flat();
    const sum = rolls.filter((die) => die.kept).reduce((total, die) => total + die.value, 0);
    return { term, rolls, subtotal: term.sign * sum };
  });
  const d20s = terms.flatMap((t) => t.rolls).filter((die) => die.kept && die.sides === 20);
  const natural = d20s.length === 1 && (d20s[0].value === 20 || d20s[0].value === 1);
  return {
    expression: formatDice(expression),
    mode,
    total: terms.reduce((total, term) => total + term.subtotal, 0),
    terms,
    ...(natural ? { natural: d20s[0].value as 20 | 1 } : {}),
  };
}

export type RollTextResult = { ok: true; result: RollResult } | { ok: false; error: string };

/** Parses and rolls in one step, for text typed by the DM. */
export function rollText(source: string, rng: Rng, mode: RollMode = "normal"): RollTextResult {
  const parsed = parseDice(source);
  return parsed.ok ? { ok: true, result: roll(parsed.expression, rng, mode) } : parsed;
}

function rollOne(sides: number, rng: Rng, mode: RollMode): DieRoll[] {
  const first = rng(sides);
  if (mode === "normal" || sides !== 20) return [{ sides, value: first, kept: true }];
  const second = rng(sides);
  const keepFirst = mode === "advantage" ? first >= second : first <= second;
  return [
    { sides, value: first, kept: keepFirst },
    { sides, value: second, kept: !keepFirst },
  ];
}
