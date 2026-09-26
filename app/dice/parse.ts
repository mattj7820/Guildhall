/** A parsed dice expression such as `2d6+3` or `1d8 + 1d6 - 1`. */
export interface DiceExpression {
  terms: Term[];
}

export type Term =
  | { kind: "dice"; sign: 1 | -1; count: number; sides: number }
  | { kind: "constant"; value: number };

export type ParseResult = { ok: true; expression: DiceExpression } | { ok: false; error: string };

export const MAX_DICE = 100;
export const MAX_SIDES = 1000;
const MAX_TERMS = 20;

const TERM = /^([+-]?)(?:(\d*)d(\d+)|(\d+))/;

/**
 * Parses a dice expression. Accepts spaces, `D`, a typographic minus (`−`) and the Fantasy
 * Statblocks plugin's `5d6 + -1`.
 */
export function parseDice(source: string): ParseResult {
  let rest = source
    .toLowerCase()
    .replace(/[−–]/g, "-")
    // Only spaces around operators are dropped, so "2d6 3" is an error rather than "2d63".
    .replace(/\s*([+-])\s*/g, "$1")
    .trim()
    .replace(/\+-|-\+/g, "-")
    .replace(/--/g, "+");
  if (!rest) return { ok: false, error: "Enter dice to roll, like 2d6+3." };

  const terms: Term[] = [];
  while (rest) {
    const match = TERM.exec(rest);
    if (!match || (terms.length > 0 && !match[1])) {
      return { ok: false, error: `Couldn't read "${source.trim()}". Try something like 2d6+3.` };
    }
    const sign = match[1] === "-" ? -1 : 1;
    if (match[4] !== undefined) {
      terms.push({ kind: "constant", value: sign * Number(match[4]) });
    } else {
      const count = match[2] === "" ? 1 : Number(match[2]);
      const sides = Number(match[3]);
      if (count < 1 || count > MAX_DICE) {
        return { ok: false, error: `Roll between 1 and ${MAX_DICE} dice at a time.` };
      }
      if (sides < 1 || sides > MAX_SIDES) {
        return { ok: false, error: `Dice can have between 1 and ${MAX_SIDES} sides.` };
      }
      terms.push({ kind: "dice", sign, count, sides });
    }
    if (terms.length > MAX_TERMS) return { ok: false, error: "That expression is too long." };
    rest = rest.slice(match[0].length);
  }
  return { ok: true, expression: { terms } };
}

/** Canonical display form, e.g. `2d6 + 3`, `1d20 − 1`. */
export function formatDice(expression: DiceExpression): string {
  return expression.terms
    .map((term, index) => {
      const negative = term.kind === "dice" ? term.sign < 0 : term.value < 0;
      const body =
        term.kind === "dice" ? `${term.count}d${term.sides}` : String(Math.abs(term.value));
      if (index === 0) return negative ? `−${body}` : body;
      return `${negative ? " − " : " + "}${body}`;
    })
    .join("");
}
