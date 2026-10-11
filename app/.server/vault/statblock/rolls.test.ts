import { describe, expect, it } from "vitest";
import { findBonuses, findRolls, type RollToken } from "./rolls";

const rollsIn = (text: string) =>
  findRolls(text).filter(
    (token): token is Extract<RollToken, { type: "roll" }> => token.type === "roll",
  );

describe("findRolls", () => {
  it("keeps every character, in order", () => {
    const text = "Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) piercing damage.";
    expect(
      findRolls(text)
        .map((token) => token.text)
        .join(""),
    ).toBe(text);
  });

  it.each([
    ["an attack bonus", "Melee Weapon Attack: +4 to hit", "+4", "attack", "1d20 + 4"],
    ["a negative attack bonus", "Ranged Weapon Attack: -1 to hit", "-1", "attack", "1d20 − 1"],
    ["damage dice with a modifier", "Hit: 5 (1d6 + 2) damage", "1d6 + 2", "damage", "1d6 + 2"],
    ["damage dice with a minus", "Hit: 1 (1d4 − 1) damage", "1d4 − 1", "damage", "1d4 − 1"],
    ["plain dice", "takes 7 (2d6) fire damage", "2d6", "damage", "2d6"],
    ["a die without a count", "roll a d4", "d4", "damage", "1d4"],
    ["a 2024 attack roll", "Melee Attack Roll: +4, reach 5 ft.", "+4", "attack", "1d20 + 4"],
    ["a 2024 negative attack roll", "Ranged Attack Roll: −1, range", "−1", "attack", "1d20 − 1"],
  ])("finds %s", (_label, text, button, kind, expression) => {
    expect(rollsIn(text)).toEqual([{ type: "roll", text: button, kind, expression }]);
  });

  it("finds several rolls in one description", () => {
    const text = "Hit: 6 (1d8 + 2) slashing damage plus 7 (2d6) fire damage.";
    expect(rollsIn(text).map((roll) => roll.expression)).toEqual(["1d8 + 2", "2d6"]);
  });

  it.each([
    ["Recharge 5–6", 5],
    ["Recharge 5-6", 5],
    ["Recharge 6", 6],
  ])("finds %s", (text, rechargeOn) => {
    expect(rollsIn(`Fire Breath (${text})`)).toEqual([
      { type: "roll", text, kind: "recharge", expression: "1d6", rechargeOn },
    ]);
  });

  it.each([
    ["a save DC", "DC 13 Dexterity saving throw"],
    ["a 2024 save DC", "Dexterity Saving Throw: DC 13, each creature"],
    ["a bonus that isn't an attack roll", "Initiative +2 (12)"],
    ["reach and range", "reach 5 ft., range 80/320 ft."],
    ["dice-like parts of words", "room B2d4x and code 3d6x"],
    ["numbers on their own", "It has 12 hit points"],
    ["a version number", "v1.2d6"],
  ])("leaves %s as text", (_label, text) => {
    expect(rollsIn(text)).toEqual([]);
  });

  it("finds a leading attack bonus in text after a split-off 2024 label", () => {
    const text = " +4, reach 5 ft. ";
    expect(rollsIn(text)).toEqual([]);
    const tokens = findRolls(text, { afterAttackRoll: true });
    expect(tokens.map((token) => token.text).join("")).toBe(text);
    expect(tokens).toContainEqual({
      type: "roll",
      text: "+4",
      kind: "attack",
      expression: "1d20 + 4",
    });
  });

  it("doesn't swallow a following dice term into a modifier", () => {
    expect(rollsIn("1d8 + 1d6").map((roll) => roll.expression)).toEqual(["1d8", "1d6"]);
  });
});

describe("findBonuses", () => {
  it("reads each bonus in a saves or skills line", () => {
    expect(findBonuses("Dex +4, Sleight Of Hand +5, Wis -1")).toEqual([
      { text: "Dex +4", name: "Dex", expression: "1d20 + 4" },
      { text: "Sleight Of Hand +5", name: "Sleight Of Hand", expression: "1d20 + 5" },
      { text: "Wis -1", name: "Wis", expression: "1d20 − 1" },
    ]);
  });
});
