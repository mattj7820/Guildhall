import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseStatblock, statblockFromData, type Statblock } from "./parse-statblock";

const yaml = (...lines: string[]) => lines.join("\n");

function parsed(source: string): Statblock {
  const result = parseStatblock(source);
  if (!result.ok) throw new Error(`Expected a statblock, got error: ${result.error}`);
  return result.statblock;
}

/** The Fantasy Statblocks plugin's format, as it writes SRD creatures into notes. */
const PLUGIN_STATBLOCK = yaml(
  "name: Test Creature",
  "source: 5e SRD",
  "size: Small",
  "type: construct",
  'subtype: ""',
  "alignment: unaligned",
  "ac: 17",
  "hp: 17",
  "hit_dice: 5d6 + -1",
  "speed: 0 ft., fly 50 ft.",
  "stats:",
  "  - 12",
  "  - 15",
  "  - 11",
  "  - 1",
  "  - 5",
  "  - 1",
  "saves:",
  "  - dexterity: 4",
  "skillsaves:",
  "  - perception: 3",
  "  - sleight_of_hand: 5",
  'damage_vulnerabilities: ""',
  "damage_immunities: poison, psychic",
  "senses: blindsight 60 ft., passive Perception 7",
  'languages: ""',
  "cr: 1/4",
  "bestiary: true",
  "traits:",
  "  - name: Test Trait",
  "    desc: Fixture trait text.",
  "    attack_bonus: 0",
  "actions:",
  "  - name: Test Slam",
  '    desc: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) damage."',
  "    attack_bonus: 3",
);

describe("parseStatblock", () => {
  it("reads the Fantasy Statblocks plugin format", () => {
    expect(parsed(PLUGIN_STATBLOCK)).toEqual({
      name: "Test Creature",
      description: "Small construct, unaligned",
      size: "Small",
      type: "construct",
      challengeRating: "1/4",
      armorClass: "17",
      hitPoints: "17 (5d6 − 1)",
      speed: "0 ft., fly 50 ft.",
      abilities: [
        { ability: "STR", score: 12, modifier: "+1" },
        { ability: "DEX", score: 15, modifier: "+2" },
        { ability: "CON", score: 11, modifier: "+0" },
        { ability: "INT", score: 1, modifier: "-5" },
        { ability: "WIS", score: 5, modifier: "-3" },
        { ability: "CHA", score: 1, modifier: "-5" },
      ],
      savingThrows: "Dex +4",
      skills: "Perception +3, Sleight Of Hand +5",
      damageImmunities: "poison, psychic",
      senses: "blindsight 60 ft., passive Perception 7",
      challenge: "1/4 (50 XP)",
      traits: [{ name: "Test Trait", description: "Fixture trait text." }],
      actions: [
        {
          name: "Test Slam",
          description:
            "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) damage.",
        },
      ],
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      numbers: {
        armorClass: 17,
        hitPoints: 17,
        hitDice: "5d6 − 1",
        initiative: 2,
        squares: 1,
      },
    });
  });

  describe("numbers for the combat tracker", () => {
    it.each([
      ["a plain number", "ac: 15", 15],
      ["armour in brackets", 'ac: "15 (leather armor)"', 15],
      ["text with no number", "ac: varies", undefined],
    ])("reads the armour class from %s", (_label, line, expected) => {
      expect(parsed(yaml("name: X", line)).numbers.armorClass).toBe(expected);
    });

    it.each([
      ["8d8 + 16", "8d8 + 16"],
      ["1d4 + -2", "1d4 − 2"],
      ["2d6", "2d6"],
      ["lots", undefined],
    ])("normalises hit dice %j to a rollable expression", (dice, expected) => {
      expect(parsed(yaml("name: X", `hit_dice: ${dice}`)).numbers.hitDice).toBe(expected);
    });

    it.each([
      ["Tiny", 1],
      ["Medium", 1],
      ["Large", 2],
      ["huge", 3],
      ["Gargantuan", 4],
      ["Titanic", undefined],
    ])("takes %s as %s square(s) across", (size, squares) => {
      expect(parsed(yaml("name: X", `size: ${size}`)).numbers.squares).toBe(squares);
    });

    it("rounds a negative DEX modifier down", () => {
      expect(parsed(yaml("name: X", "stats: [10, 7, 10, 10, 10, 10]")).numbers).toMatchObject({
        initiative: -2,
      });
    });

    it("has no HP or AC, and a zero DEX modifier, when the statblock omits them", () => {
      expect(parsed(yaml("name: X")).numbers).toEqual({ initiative: 0 });
    });
  });

  describe("2024 statblocks", () => {
    it("reads an initiative bonus, which wins over the DEX modifier", () => {
      const statblock = parsed(yaml("name: X", "stats: [10, 14, 10, 10, 10, 10]", "initiative: 4"));
      expect(statblock.initiative).toBe("+4 (14)");
      expect(statblock.numbers.initiative).toBe(4);
    });

    it("ignores an initiative that isn't a whole number", () => {
      const statblock = parsed(
        yaml("name: X", "stats: [10, 14, 10, 10, 10, 10]", "initiative: fast"),
      );
      expect(statblock.initiative).toBeUndefined();
      expect(statblock.numbers.initiative).toBe(2);
    });

    it("sizes a creature of either of two sizes by the larger", () => {
      expect(parsed(yaml("name: X", "size: Medium or Small")).numbers.squares).toBe(1);
      expect(parsed(yaml("name: X", "size: Small or Large")).numbers.squares).toBe(2);
    });

    it("reads gear", () => {
      expect(parsed(yaml("name: X", "gear: Fixture Spear, Fixture Shield")).gear).toBe(
        "Fixture Spear, Fixture Shield",
      );
    });
  });

  it("reads the same fields from data as from YAML", () => {
    const data = parseYaml(PLUGIN_STATBLOCK) as unknown;
    expect(statblockFromData(data)).toEqual(parseStatblock(PLUGIN_STATBLOCK));
  });

  it("includes the subtype in the description", () => {
    const statblock = parsed(
      yaml("name: X", "size: Small", "type: humanoid", "subtype: goblinoid"),
    );
    expect(statblock.description).toBe("Small humanoid (goblinoid)");
  });

  it.each([
    ["8d8 + 16", "52 (8d8 + 16)"],
    ["1d4 + -2", "52 (1d4 − 2)"],
    ["2d6-1", "52 (2d6 − 1)"],
  ])("formats hit dice %j", (dice, expected) => {
    expect(parsed(yaml("name: X", "hp: 52", `hit_dice: ${dice}`)).hitPoints).toBe(expected);
  });

  it.each([
    ['"0"', "0 (10 XP)"],
    ['"3"', "3 (700 XP)"],
    ["12", "12 (8,400 XP)"],
    ["homebrew", "homebrew"],
  ])("adds XP for challenge rating %s", (cr, expected) => {
    expect(parsed(yaml("name: X", `cr: ${cr}`)).challenge).toBe(expected);
  });

  it("accepts saves written as a map", () => {
    expect(parsed(yaml("name: X", "saves:", "  con: 4", "  wis: -1")).savingThrows).toBe(
      "Con +4, Wis -1",
    );
  });

  it("ignores ability scores unless there are exactly six numbers", () => {
    expect(parsed(yaml("name: X", "stats: [10, 10]")).abilities).toBeUndefined();
    expect(parsed(yaml("name: X", "stats: [a, 1, 2, 3, 4, 5]")).abilities).toBeUndefined();
  });

  it("reads bonus actions, reactions and legendary actions", () => {
    const statblock = parsed(
      yaml(
        "name: X",
        "bonus_actions: [{ name: Dash, desc: Moves. }]",
        "reactions: [{ name: Parry, desc: Blocks. }]",
        "legendary_description: Takes 3 legendary actions.",
        "legendary_actions: [{ name: Detect, desc: Looks. }]",
      ),
    );
    expect(statblock.bonusActions).toEqual([{ name: "Dash", description: "Moves." }]);
    expect(statblock.reactions).toEqual([{ name: "Parry", description: "Blocks." }]);
    expect(statblock.legendaryDescription).toBe("Takes 3 legendary actions.");
    expect(statblock.legendaryActions).toEqual([{ name: "Detect", description: "Looks." }]);
  });

  it("turns the spells list into a Spellcasting trait", () => {
    const statblock = parsed(
      yaml(
        "name: X",
        "spells:",
        "  - The creature is a spellcaster.",
        '  - "Cantrips (at will)": light, mage hand',
      ),
    );
    expect(statblock.traits).toEqual([
      {
        name: "Spellcasting",
        description: "The creature is a spellcaster.\nCantrips (at will): light, mage hand",
      },
    ]);
  });

  describe("errors", () => {
    it.each([
      ["invalid YAML", "name: [unclosed", /isn't valid YAML/],
      ["an empty block", "", /empty/],
      ["a plain list", "- a\n- b", /empty or not a list of fields/],
      ["no name", "ac: 12", /no name/],
      ["a bestiary reference", "monster: Goblin", /refers to "Goblin" in the plugin's bestiary/],
    ])("explains %s", (_label, source, message) => {
      const result = parseStatblock(source);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(message);
    });
  });
});
