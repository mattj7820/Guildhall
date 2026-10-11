import { formatDice, parseDice } from "~/dice/parse";

/** A piece of statblock text: plain, or something the DM can click to roll. */
export type RollToken =
  | { type: "text"; text: string }
  | {
      type: "roll";
      /** What the button shows, e.g. "+4" or "1d6 + 2". */
      text: string;
      kind: "attack" | "damage" | "recharge";
      /** Canonical dice, e.g. "1d20 + 4". Recharge always rolls 1d6. */
      expression: string;
      /** Recharge only: the lowest face that recharges. */
      rechargeOn?: number;
    };

// Attack bonuses ("+4 to hit", or 2024's "Attack Roll: +4"), recharge ("Recharge 5–6",
// "Recharge 6"), and dice ("1d6 + 2").
const ROLLS =
  /([+−-]\d+)(?= to hit)|(?<=Attack Roll:\s*)([+−-]\d+)|Recharge (\d)(?:\s*[–-]\s*6)?|(?<![\w.])\d*d\d+(?:\s*[+−-]\s*\d+(?!\s*d\d))?(?![\w.])/g;

/**
 * Splits text into plain text and rolls, keeping every character in order. With `afterAttackRoll`
 * the text follows a 2024 "Attack Roll:" label that was split off, so a leading bonus is the attack.
 */
export function findRolls(
  text: string,
  { afterAttackRoll = false }: { afterAttackRoll?: boolean } = {},
): RollToken[] {
  if (afterAttackRoll) {
    const prefix = "Attack Roll:";
    return trimStart(findRolls(prefix + text), prefix.length);
  }
  const tokens: RollToken[] = [];
  let last = 0;
  for (const match of text.matchAll(ROLLS)) {
    const roll = toRoll(match);
    if (!roll) continue;
    if (match.index > last) tokens.push({ type: "text", text: text.slice(last, match.index) });
    tokens.push(roll);
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens;
}

/** Drops the first `length` characters, which are always plain text. */
function trimStart(tokens: RollToken[], length: number): RollToken[] {
  const [first, ...rest] = tokens;
  if (first?.type !== "text") return tokens;
  const text = first.text.slice(length);
  return text ? [{ type: "text", text }, ...rest] : rest;
}

function toRoll(match: RegExpExecArray | RegExpMatchArray): RollToken | undefined {
  const [text, toHit, attackRoll, recharge] = match;
  const bonus = toHit ?? attackRoll;
  if (recharge) {
    return {
      type: "roll",
      text,
      kind: "recharge",
      expression: "1d6",
      rechargeOn: Number(recharge),
    };
  }
  const expression = dice(bonus ? `1d20 ${bonus}` : text);
  if (!expression) return undefined;
  return { type: "roll", text, kind: bonus ? "attack" : "damage", expression };
}

/** Canonical dice for an expression, or undefined if it isn't one. */
export function dice(source: string): string | undefined {
  const parsed = parseDice(source);
  return parsed.ok ? formatDice(parsed.expression) : undefined;
}

/**
 * The bonuses in a saving throws or skills line, e.g. "Dex +4, Stealth +6", as the name and
 * expression for each ("Dex", "1d20 + 4").
 */
export function findBonuses(line: string): { text: string; name: string; expression: string }[] {
  return [...line.matchAll(/([A-Za-z][A-Za-z ]*?) ([+−-]\d+)/g)].flatMap((match) => {
    const expression = dice(`1d20 ${match[2]}`);
    return expression ? [{ text: match[0], name: match[1], expression }] : [];
  });
}
