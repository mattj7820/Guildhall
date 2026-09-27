import { describe, expect, it } from "vitest";
import { critical, formatDice, parseDice } from "./parse";
import { sequenceRng } from "./rng";
import { rollText } from "./roll";
import {
  emptyRollLog,
  ROLL_LOG_LENGTH,
  rollInto,
  type RollLog,
  type RollRequest,
} from "./roll-log";

function rolled(log: RollLog, request: RollRequest, faces: number[]): RollLog {
  const outcome = rollInto(log, request, sequenceRng(faces));
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.log;
}

const attack: RollRequest = {
  expression: "1d20 + 4",
  kind: "attack",
  label: "Goblin 1 · Scimitar attack",
};
const damage: RollRequest = {
  expression: "1d6 + 2",
  kind: "damage",
  label: "Goblin 1 · Scimitar damage",
};

describe("natural 20s and 1s", () => {
  function natural(source: string, faces: number[], mode?: "disadvantage") {
    const outcome = rollText(source, sequenceRng(faces), mode);
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.result.natural;
  }

  it.each([
    [20, 20],
    [1, 1],
    [13, undefined],
  ])("flags a d20 that lands on %i", (face, expected) => {
    expect(natural("1d20 + 4", [face])).toBe(expected);
  });

  it("uses the kept die with advantage or disadvantage", () => {
    expect(natural("1d20", [20, 3], "disadvantage")).toBeUndefined();
  });

  it("doesn't flag rolls with several d20s", () => {
    expect(natural("2d20", [20, 20])).toBeUndefined();
  });
});

describe("critical", () => {
  it.each([
    ["1d6 + 2", "2d6 + 2"],
    ["2d6 + 1d8 − 1", "4d6 + 2d8 − 1"],
    ["3", "3"],
  ])("doubles the dice of %s but not the modifiers", (source, expected) => {
    const parsed = parseDice(source);
    expect(parsed.ok && formatDice(critical(parsed.expression))).toBe(expected);
  });
});

describe("rollInto", () => {
  it("records labelled rolls, newest first", () => {
    let log = rolled(emptyRollLog, attack, [13]);
    log = rolled(log, damage, [4]);
    expect(log.rolls.map((r) => [r.label, r.result.total])).toEqual([
      ["Goblin 1 · Scimitar damage", 6],
      ["Goblin 1 · Scimitar attack", 17],
    ]);
  });

  it(`keeps the last ${ROLL_LOG_LENGTH} rolls`, () => {
    let log = emptyRollLog;
    for (let i = 0; i < ROLL_LOG_LENGTH + 3; i++) log = rolled(log, damage, [1]);
    expect(log.rolls).toHaveLength(ROLL_LOG_LENGTH);
    expect(log.rolls[0].id).toBe(ROLL_LOG_LENGTH + 3);
  });

  it("reports an expression it can't read, changing nothing", () => {
    const log = { ...emptyRollLog, mode: "advantage" as const };
    expect(
      rollInto(log, { expression: "fireball", kind: "custom" }, sequenceRng([])),
    ).toMatchObject({ ok: false });
  });

  describe("advantage and disadvantage", () => {
    const withAdvantage: RollLog = { ...emptyRollLog, mode: "advantage" };

    it("apply to one d20 roll, then go back to normal", () => {
      const log = rolled(withAdvantage, attack, [6, 17]);
      expect(log.rolls[0].result.total).toBe(21);
      expect(log.mode).toBe("normal");
    });

    it("wait for a d20 roll: damage doesn't use them up", () => {
      const log = rolled(withAdvantage, damage, [4]);
      expect(log.mode).toBe("advantage");
    });
  });

  describe("critical hits", () => {
    it("switch on after a natural 20 on an attack", () => {
      expect(rolled(emptyRollLog, attack, [20]).critical).toBe(true);
    });

    it("double the next damage roll's dice, then switch off", () => {
      const armed = rolled(emptyRollLog, attack, [20]);
      const log = rolled(armed, damage, [4, 5]);
      expect(log.rolls[0]).toMatchObject({
        critical: true,
        result: { expression: "2d6 + 2", total: 11 },
      });
      expect(log.critical).toBe(false);
    });

    it("switch off after an attack that isn't a natural 20", () => {
      const armed = { ...emptyRollLog, critical: true };
      expect(rolled(armed, attack, [12]).critical).toBe(false);
    });

    it("don't apply to checks, and wait for the damage", () => {
      const armed = { ...emptyRollLog, critical: true };
      const log = rolled(armed, { expression: "1d20 + 2", kind: "check" }, [9]);
      expect(log.rolls[0].critical).toBe(false);
      expect(log.critical).toBe(true);
    });

    it("apply to a typed roll without a d20, when switched on by hand", () => {
      const armed = { ...emptyRollLog, critical: true };
      const log = rolled(armed, { expression: "2d6 + 3", kind: "custom" }, [1, 2, 3, 4]);
      expect(log.rolls[0]).toMatchObject({ critical: true, result: { total: 13 } });
    });
  });

  describe("recharge", () => {
    const recharge = (on: number): RollRequest => ({
      expression: "",
      kind: "recharge",
      label: "Goblin 1 · Fire Breath recharge",
      rechargeOn: on,
    });

    it.each([
      [5, 5, true],
      [5, 4, false],
      [6, 6, true],
    ])("with Recharge %i–6, a %i on the d6 recharges: %s", (on, face, recharged) => {
      const log = rolled(emptyRollLog, recharge(on), [face]);
      expect(log.rolls[0]).toMatchObject({ recharged, result: { expression: "1d6", total: face } });
    });
  });
});
