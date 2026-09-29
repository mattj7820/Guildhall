import { describe, expect, it } from "vitest";
import { deriveSheet } from "./derive";
import { aSheet } from "./test-builders";

/** DEX 16 (+3), WIS 12 (+1), INT 8 (-1), proficiency bonus +2. */
const sheet = aSheet({
  abilities: { str: 10, dex: 16, con: 14, int: 8, wis: 12, cha: 10 },
  proficiencyBonus: 2,
});

describe("deriveSheet", () => {
  it("works out each ability's modifier", () => {
    expect(deriveSheet(sheet).modifiers).toEqual({
      str: 0,
      dex: 3,
      con: 2,
      int: -1,
      wis: 1,
      cha: 0,
    });
  });

  it("adds the proficiency bonus to proficient saves, and twice for expertise skills", () => {
    const derived = deriveSheet({
      ...sheet,
      saves: { ...sheet.saves, dex: "proficient" },
      skills: { ...sheet.skills, stealth: "expertise", arcana: "proficient" },
    });
    expect(derived.saves.dex.value).toBe(5);
    expect(derived.saves.wis.value).toBe(1);
    expect(derived.skills.stealth.value).toBe(7);
    expect(derived.skills.arcana.value).toBe(1);
    expect(derived.skills.acrobatics.value).toBe(3);
  });

  it("uses DEX for initiative, and 10 plus the skill for passive scores", () => {
    const derived = deriveSheet({
      ...sheet,
      skills: { ...sheet.skills, perception: "proficient" },
    });
    expect(derived.initiative.value).toBe(3);
    expect(derived.passives).toMatchObject({
      perception: { value: 13 },
      insight: { value: 11 },
      investigation: { value: 9 },
    });
  });

  it("lets a typed number win, keeping the computed one alongside", () => {
    const derived = deriveSheet({
      ...sheet,
      overrides: { "skill.stealth": 9, initiative: 5, "save.con": 0 },
    });
    expect(derived.skills.stealth).toEqual({ value: 9, computed: 3, overridden: true });
    expect(derived.initiative).toEqual({ value: 5, computed: 3, overridden: true });
    expect(derived.saves.con).toEqual({ value: 0, computed: 2, overridden: true });
    expect(derived.skills.athletics).toEqual({ value: 0, computed: 0, overridden: false });
  });

  it("bases a passive score on the skill as shown, override included", () => {
    const derived = deriveSheet({ ...sheet, overrides: { "skill.perception": 6 } });
    expect(derived.passives.perception.value).toBe(16);

    const typed = deriveSheet({ ...sheet, overrides: { "passive.perception": 20 } });
    expect(typed.passives.perception).toEqual({ value: 20, computed: 11, overridden: true });
  });
});
