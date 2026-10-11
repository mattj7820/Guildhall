import { describe, expect, it } from "vitest";
import { parseNote } from "./parse-note";
import { spellFields } from "./spell-fields";

describe("spellFields", () => {
  it("reads every field the README gives", () => {
    expect(
      spellFields({
        level: 1,
        school: "Evocation",
        classes: ["artificer", "Wizard"],
        casting_time: "1 action",
        range: "60 feet",
        components: "V, S, M",
        duration: "Concentration, up to 1 minute",
        concentration: true,
        ritual: false,
        attack: true,
        save: "dex",
        roll: "3d8",
        effect: "bludgeoning",
        area: "20 ft cube",
      }),
    ).toEqual({
      level: 1,
      school: "Evocation",
      classes: ["Artificer", "Wizard"],
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      concentration: true,
      ritual: false,
      attack: true,
      save: "dex",
      roll: "3d8",
      effect: "bludgeoning",
      area: { shape: "cube", feet: 20 },
    });
  });

  it("is empty for a note that gives nothing", () => {
    expect(spellFields({})).toEqual({ classes: [] });
  });

  it.each([
    ["cantrip", 0],
    ["3", 3],
    [0, 0],
  ])("reads the level %j", (level, read) => {
    expect(spellFields({ level }).level).toBe(read);
  });

  it.each([
    ["DEX", "dex"],
    ["Wisdom", "wis"],
  ])("reads the save %j", (save, read) => {
    expect(spellFields({ save }).save).toBe(read);
  });

  it.each([
    ["20-foot cone", { shape: "cone", feet: 20 }],
    ["15 ft. radius", { shape: "sphere", feet: 15 }],
    ["100 feet line", { shape: "line", feet: 100 }],
  ])("reads the area %j", (area, read) => {
    expect(spellFields({ area }).area).toEqual(read);
  });

  it("reads classes written as one line, and yes or no", () => {
    expect(spellFields({ classes: "artificer, wizard", ritual: "yes" })).toMatchObject({
      classes: ["Artificer", "Wizard"],
      ritual: true,
    });
  });

  it("leaves out what it can't read, keeping the rest", () => {
    expect(
      spellFields({
        level: 12,
        save: "luck",
        roll: "lots",
        area: "a big circle",
        concentration: "maybe",
        range: "Touch",
      }),
    ).toEqual({ classes: [], range: "Touch" });
  });
});

describe("spell notes", () => {
  it("carry their fields, and other notes don't", () => {
    const spell = parseNote("Spells/A.md", "---\ntype: spell\nlevel: 2\n---\nBody");
    const npc = parseNote("NPCs/B.md", "---\ntype: npc\nlevel: 2\n---\nBody");
    expect(spell.spell).toEqual({ level: 2, classes: [] });
    expect(npc.spell).toBeUndefined();
  });
});
