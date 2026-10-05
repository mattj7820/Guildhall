import { describe, expect, it } from "vitest";
import type { CharacterAction } from "./actions";
import { actionLabel, derivedLabel, replacedNotice } from "./describe";

describe("actionLabel", () => {
  it.each<[CharacterAction, string]>([
    [{ type: "number", field: "armourClass", value: 15 }, "Armour class"],
    [{ type: "ability", ability: "dex", value: 16 }, "Dexterity"],
    [
      { type: "skill", skill: "sleight-of-hand", value: "proficient" },
      "Sleight of Hand proficiency",
    ],
    [{ type: "override", key: "save.wis", value: 5 }, "Wisdom save"],
    [{ type: "hp", field: "temp", value: 5 }, "Temporary hit points"],
    [{ type: "text", field: "className", value: "Rogue" }, "Class"],
    [{ type: "limit", counter: { slot: 2 }, value: 3 }, "2nd-level spell slots"],
    [{ type: "limit", counter: { hitDie: "d10" }, value: 3 }, "d10 hit dice"],
    [{ type: "rest", rest: "long" }, "Long rest"],
    [{ type: "text", field: "concentrating", value: "" }, "Concentration"],
  ])("names %j", (action, label) => {
    expect(actionLabel(action)).toBe(label);
  });
});

it.each([
  ["initiative", "Initiative"],
  ["skill.animal-handling", "Animal Handling"],
  ["passive.perception", "Passive Perception"],
  ["spell.dc", "Spell save DC"],
  ["spell.attack", "Spell attack bonus"],
] as const)("names the derived number %s", (key, label) => {
  expect(derivedLabel(key)).toBe(label);
});

describe("replacedNotice", () => {
  it("says what was there and that theirs was kept", () => {
    expect(replacedNotice({ type: "number", field: "armourClass", value: 15 }, 16)).toBe(
      "Armour class had been changed to 16 elsewhere; yours (15) was kept.",
    );
  });

  it("describes blanks, switches and long text plainly", () => {
    expect(replacedNotice({ type: "inspiration", value: false }, true)).toBe(
      "Heroic inspiration had been changed to on elsewhere; yours (off) was kept.",
    );
    expect(replacedNotice({ type: "text", field: "notes", value: "" }, "x".repeat(50))).toBe(
      `Notes had been changed to ${"x".repeat(40)}… elsewhere; yours (blank) was kept.`,
    );
  });
});
