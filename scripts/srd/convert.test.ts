import { describe, expect, it } from "vitest";
import {
  convertMonster,
  initiativeFinder,
  type SourceMonster,
  type SrdVersion,
} from "./convert.ts";
import sample from "./sample.json";

const records = {
  "5.1": sample["2014"] as unknown as SourceMonster[],
  "5.2": sample["2024"] as unknown as SourceMonster[],
};
const spellLevels = new Map(Object.entries(sample.spellLevels));
const initiative = initiativeFinder(sample.open5e);

function converted(version: SrdVersion, id: string) {
  const record = records[version].find((each) => each.index === id);
  if (!record) throw new Error(`${id} isn't in the sample`);
  return convertMonster(record, version, { initiative: initiative(record.name), spellLevels });
}

const statblock = (version: SrdVersion, id: string) => converted(version, id).statblock;
const named = (features: unknown, name: string) =>
  (features as { name: string; desc: string }[]).find((feature) => feature.name.startsWith(name));

describe("convertMonster: SRD 5.2.1 (2024)", () => {
  it("writes a statblock in the plugin's format, with the 2024 book's wording", () => {
    expect(converted("5.2", "goblin-warrior")).toEqual({
      id: "goblin-warrior",
      statblock: {
        name: "Goblin Warrior",
        size: "Small",
        type: "Fey",
        alignment: "Chaotic Neutral",
        ac: "15",
        initiative: 2,
        hp: 10,
        hit_dice: "3d6",
        speed: "30 ft.",
        stats: [8, 15, 10, 10, 8, 8],
        skillsaves: [{ stealth: 6 }],
        gear: "Leather Armor, Scimitar, Shield, Shortbow",
        senses: "Darkvision 60 ft.; Passive Perception 9",
        languages: "Common, Goblin",
        cr: "1/4",
        actions: [
          {
            name: "Scimitar",
            desc: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.",
          },
          {
            name: "Shortbow",
            desc: "Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.",
          },
        ],
        bonus_actions: [
          { name: "Nimble Escape", desc: "The goblin takes the Disengage or Hide action." },
        ],
      },
    });
  });

  it("takes initiative from elsewhere, since it can differ from DEX", () => {
    const dragon = statblock("5.2", "adult-red-dragon");
    expect(dragon.initiative).toBe(12);
    expect(dragon.stats).toEqual([27, 10, 25, 16, 13, 23]);
  });

  it("gives a lycanthrope's forms their creature's initiative", () => {
    expect(initiative("Werewolf, Hybrid Form")).toBe(4);
    expect(statblock("5.2", "werewolf-hybrid").initiative).toBe(4);
  });

  it("matches names whatever their apostrophes", () => {
    const find = initiativeFinder([{ fields: { name: "Will-o'-Wisp", initiative_bonus: 9 } }]);
    expect(find("Will-o’-Wisp")).toBe(9);
  });

  it("names recharges and uses a day as the 2024 book does, lair included", () => {
    const dragon = statblock("5.2", "adult-red-dragon");
    expect(named(dragon.traits, "Legendary Resistance")?.name).toBe(
      "Legendary Resistance (3/Day, or 4/Day in Lair)",
    );
    expect(named(dragon.actions, "Fire Breath")?.name).toBe("Fire Breath (Recharge 5–6)");
  });

  it("keeps multiattack, bonus actions and legendary actions", () => {
    const dragon = statblock("5.2", "adult-red-dragon");
    expect(named(dragon.actions, "Multiattack")?.desc).toMatch(/^The dragon makes three Rend/);
    expect((dragon.legendary_actions as unknown[]).length).toBe(3);
    expect(named(dragon.legendary_actions, "Pounce")?.desc).toContain("Rend attack");
  });

  it("lists a Spellcasting action's spells by how often, with higher-level versions", () => {
    expect(named(statblock("5.2", "mage").actions, "Spellcasting")?.desc).toBe(
      [
        "The mage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):",
        "At Will: Detect Magic, Light, Mage Armor (Included in AC), Mage Hand, Prestidigitation",
        "2/Day Each: Fireball (level 4 version), Invisibility",
        "1/Day Each: Cone of Cold, Fly",
      ].join("\n"),
    );
  });

  it("shows only the number for AC, as the 2024 book does", () => {
    expect(statblock("5.2", "adult-red-dragon").ac).toBe("19");
  });

  it("speeds and senses in the 2024 style", () => {
    const dragon = statblock("5.2", "adult-red-dragon");
    expect(dragon.speed).toBe("40 ft., Climb 40 ft., Fly 80 ft.");
    expect(dragon.senses).toBe("Blindsight 60 ft., Darkvision 120 ft.; Passive Perception 23");
  });
});

describe("convertMonster: SRD 5.1 (2014)", () => {
  it("writes the armour worn, the 2014 senses and no initiative", () => {
    const goblin = statblock("5.1", "goblin");
    expect(goblin.ac).toBe("15 (leather armor, shield)");
    expect(goblin.senses).toBe("darkvision 60 ft., passive Perception 9");
    expect(goblin).not.toHaveProperty("initiative");
    expect(goblin).not.toHaveProperty("gear");
  });

  it("writes armour from a spell and AC under a condition", () => {
    expect(statblock("5.1", "mage").ac).toBe("12 (15 with mage armor)");
    expect(statblock("5.1", "ankheg").ac).toBe("14 (natural armor), 11 while prone");
  });

  it("names recharges, uses a day and recharges after a rest", () => {
    expect(named(statblock("5.1", "ankheg").actions, "Acid Spray")?.name).toBe(
      "Acid Spray (Recharge 6)",
    );
    expect(named(statblock("5.1", "adult-red-dragon").traits, "Legendary")?.name).toBe(
      "Legendary Resistance (3/Day)",
    );
    expect(named(statblock("5.1", "boar").traits, "Relentless")?.name).toBe(
      "Relentless (Recharges after a Short or Long Rest)",
    );
  });

  it("leaves a name that already says how it's used alone", () => {
    expect(named(statblock("5.1", "adult-red-dragon").legendary_actions, "Wing")?.name).toBe(
      "Wing Attack (Costs 2 Actions)",
    );
  });

  it("keeps a spellcaster's spell lists, one line each", () => {
    const desc = named(statblock("5.1", "mage").traits, "Spellcasting")?.desc ?? "";
    expect(desc.split("\n")).toContain(
      "- 1st level (4 slots): detect magic, mage armor, magic missile, shield",
    );
    expect(desc).not.toContain("\n\n");
  });

  it("brings the SRD's own description as lore, where it has one", () => {
    expect(converted("5.1", "blink-dog").lore).toMatch(/^A blink dog takes its name/);
    expect(converted("5.1", "goblin")).not.toHaveProperty("lore");
    const bandit = { ...sample["2014"][0], index: "x", desc: "**Bandits** rove in gangs." };
    expect(convertMonster(bandit as unknown as SourceMonster, "5.1").lore).toBe(
      "Bandits rove in gangs.",
    );
  });
});

describe("convertMonster: the SRD's text", () => {
  it("is never rewritten: every description starts with the source's own", () => {
    for (const version of ["5.1", "5.2"] as const) {
      for (const record of records[version]) {
        const output = convertMonster(record, version, { spellLevels }).statblock;
        for (const block of [
          "special_abilities",
          "actions",
          "bonus_actions",
          "reactions",
          "legendary_actions",
        ] as const) {
          const key = block === "special_abilities" ? "traits" : block;
          const written = (output[key] ?? []) as { desc: string }[];
          (record[block] ?? []).forEach((ability, index) => {
            expect(written[index].desc).toContain(ability.desc.split("\n")[0].trim());
          });
        }
      }
    }
  });
});
