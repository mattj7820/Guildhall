import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  abilityModifier,
  proficiencyBonusFor,
  SKILL_ABILITIES,
  SKILL_NAMES,
  SKILLS,
  signed,
} from "./abilities";

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [3, -4],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [20, 5],
    [30, 10],
  ])("a score of %i gives %i", (score, modifier) => {
    expect(abilityModifier(score)).toBe(modifier);
  });

  it("goes up by one every two points, across the whole range", () => {
    for (let score = 1; score <= 30; score++) {
      expect(abilityModifier(score)).toBe(Math.floor(score / 2) - 5);
    }
  });
});

describe("proficiencyBonusFor", () => {
  it.each([
    ["none", 0],
    ["proficient", 3],
    ["expertise", 6],
  ] as const)("%s adds %i with a +3 proficiency bonus", (proficiency, bonus) => {
    expect(proficiencyBonusFor(proficiency, 3)).toBe(bonus);
  });
});

describe("the skill list", () => {
  it("has the eighteen skills, each with a name and one of the six abilities", () => {
    expect(SKILLS).toHaveLength(18);
    for (const skill of SKILLS) {
      expect(ABILITIES).toContain(SKILL_ABILITIES[skill]);
      expect(SKILL_NAMES[skill]).toBeTruthy();
    }
  });
});

it.each([
  [3, "+3"],
  [0, "+0"],
  [-1, "-1"],
])("signs %i as %s", (value, text) => {
  expect(signed(value)).toBe(text);
});
