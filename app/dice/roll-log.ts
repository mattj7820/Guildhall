import { critical, formatDice, hasD20, parseDice } from "./parse";
import type { Rng } from "./rng";
import { roll, type RollMode, type RollResult } from "./roll";

/** What a roll is for, which decides how advantage and critical hits apply to it. */
export type RollKind = "attack" | "damage" | "check" | "recharge" | "custom";

export interface RollRequest {
  expression: string;
  kind: RollKind;
  /** e.g. "Goblin 1 · Scimitar attack" */
  label?: string;
  /** Recharge: the lowest d6 face that recharges ("Recharge 5–6" → 5). */
  rechargeOn?: number;
}

export interface LoggedRoll {
  id: number;
  kind: RollKind;
  label?: string;
  result: RollResult;
  /** Damage rolled as a critical hit, with its dice doubled. */
  critical: boolean;
  /** Recharge rolls only: whether the ability came back. */
  recharged?: boolean;
}

export interface RollLog {
  /** Advantage or disadvantage lasts for one d20 roll. */
  mode: RollMode;
  /** Doubles the dice of the next damage roll. Switched on by a natural 20 on an attack. */
  critical: boolean;
  /** Newest first. */
  rolls: LoggedRoll[];
}

export const ROLL_LOG_LENGTH = 8;

export const emptyRollLog: RollLog = { mode: "normal", critical: false, rolls: [] };

export type RollOutcome = { ok: true; log: RollLog } | { ok: false; error: string };

/**
 * Rolls a request and records it. Advantage applies to (and is used up by) the next roll with a
 * d20. Critical doubles the next damage or custom roll without a d20, then switches off. An
 * attack roll switches Critical on for a natural 20, and off otherwise.
 */
export function rollInto(log: RollLog, request: RollRequest, rng: Rng): RollOutcome {
  const parsed = parseDice(request.kind === "recharge" ? "1d6" : request.expression);
  if (!parsed.ok) return parsed;

  const d20 = hasD20(parsed.expression);
  const crit = log.critical && !d20 && (request.kind === "damage" || request.kind === "custom");
  const expression = crit ? critical(parsed.expression) : parsed.expression;
  const result = roll(expression, rng, d20 ? log.mode : "normal");

  const entry: LoggedRoll = {
    id: (log.rolls[0]?.id ?? 0) + 1,
    kind: request.kind,
    label: request.label,
    result: crit ? { ...result, expression: formatDice(expression) } : result,
    critical: crit,
    ...(request.kind === "recharge"
      ? { recharged: result.total >= (request.rechargeOn ?? 6) }
      : {}),
  };

  return {
    ok: true,
    log: {
      mode: d20 ? "normal" : log.mode,
      critical: request.kind === "attack" ? result.natural === 20 : crit ? false : log.critical,
      rolls: [entry, ...log.rolls].slice(0, ROLL_LOG_LENGTH),
    },
  };
}
