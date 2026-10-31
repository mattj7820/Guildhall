import { describe, expect, it } from "vitest";
import {
  challengeValue,
  creatureLines,
  creatureTypes,
  findCreatures,
  statblockOfNote,
  tagOf,
  type CreatureFilters,
  type CreatureTag,
} from "./find-creatures";
import type { SrdSource } from "~/campaign/srd";
import { statblockKey, type CreatureOption } from "./types";

function creature(
  name: string,
  from: "vault" | SrdSource,
  extra: Partial<CreatureOption> = {},
): CreatureOption {
  const ref =
    from === "vault"
      ? { entityId: `Bestiary/${name}`, name }
      : { entityId: name.toLowerCase().replace(/ /g, "-"), name, source: from };
  return {
    key: statblockKey(ref),
    ref,
    name,
    ...(from === "vault" && { noteTitle: name, noteUrl: `/wiki/Bestiary/${name}` }),
    initiativeBonus: 0,
    ...extra,
  };
}

const CREATURES = [
  creature("Winter Wolf", "srd-5.1", { challenge: "3", type: "monstrosity" }),
  creature("Wolf", "srd-5.1", { challenge: "1/4", type: "beast" }),
  creature("Dire Wolf", "srd-5.2", { challenge: "1", type: "Beast" }),
  creature("Wolf", "srd-5.2", { challenge: "1/4", type: "Beast" }),
  creature("Fixture Werewolf Lord", "vault", { challenge: "5", type: "humanoid" }),
  creature("Wolf", "vault", { challenge: "1/2", type: "beast", noteTitle: "Fixture Pack" }),
  creature("Goblin Warrior", "srd-5.2", { challenge: "1/4", type: "Fey" }),
  creature("Fixture Bare", "vault"),
];

const filters = (overrides: Partial<CreatureFilters> = {}): CreatureFilters => ({
  query: "",
  tags: new Set<CreatureTag>(),
  ...overrides,
});

const found = (overrides: Partial<CreatureFilters> = {}) =>
  findCreatures(CREATURES, filters(overrides)).map((c) => `${c.name} (${tagOf(c)})`);

describe("findCreatures", () => {
  it("lists everything by name while browsing, the DM's own then 2024 then 2014 for one name", () => {
    expect(found()).toEqual([
      "Dire Wolf (2024)",
      "Fixture Bare (Mine)",
      "Fixture Werewolf Lord (Mine)",
      "Goblin Warrior (2024)",
      "Winter Wolf (2014)",
      "Wolf (Mine)",
      "Wolf (2024)",
      "Wolf (2014)",
    ]);
  });

  it("puts the best match first while searching: exact, prefix, a word's start, anywhere", () => {
    expect(found({ query: "wolf" })).toEqual([
      "Wolf (Mine)",
      "Wolf (2024)",
      "Wolf (2014)",
      "Dire Wolf (2024)",
      "Winter Wolf (2014)",
      "Fixture Werewolf Lord (Mine)",
    ]);
  });

  it("ignores case and spaces around the search", () => {
    expect(found({ query: "  GOBLIN " })).toEqual(["Goblin Warrior (2024)"]);
  });

  it("finds the DM's statblocks by their note's title too", () => {
    expect(found({ query: "pack" })).toEqual(["Wolf (Mine)"]);
  });

  it("shows only the tags picked", () => {
    expect(found({ query: "wolf", tags: new Set(["Mine"]) })).toEqual([
      "Wolf (Mine)",
      "Fixture Werewolf Lord (Mine)",
    ]);
    expect(found({ query: "wolf", tags: new Set(["2014"]) })).toEqual([
      "Wolf (2014)",
      "Winter Wolf (2014)",
    ]);
  });

  it("filters by challenge rating, either end inclusive, leaving out those without one", () => {
    expect(found({ lowestChallenge: "1/4", highestChallenge: "1" })).toEqual([
      "Dire Wolf (2024)",
      "Goblin Warrior (2024)",
      "Wolf (Mine)",
      "Wolf (2024)",
      "Wolf (2014)",
    ]);
    expect(found({ lowestChallenge: "3" })).toEqual([
      "Fixture Werewolf Lord (Mine)",
      "Winter Wolf (2014)",
    ]);
  });

  it("filters by type whatever its case, as 2014 and 2024 write them differently", () => {
    expect(found({ type: "beast" })).toEqual([
      "Dire Wolf (2024)",
      "Wolf (Mine)",
      "Wolf (2024)",
      "Wolf (2014)",
    ]);
  });
});

describe("creatureTypes", () => {
  it("lists each type once, without case", () => {
    expect(creatureTypes(CREATURES)).toEqual(["beast", "fey", "humanoid", "monstrosity"]);
  });
});

describe("challengeValue", () => {
  it.each([
    ["0", 0],
    ["1/8", 0.125],
    ["1/2", 0.5],
    ["30", 30],
    ["", undefined],
    ["a lot", undefined],
  ])("reads %j as %j", (rating, value) => {
    expect(challengeValue(rating)).toBe(value);
  });
});

describe("creatureLines", () => {
  it("says where each is from and its challenge, with the DM's own note when it differs", () => {
    expect([...creatureLines(CREATURES).keys()]).toEqual([
      "Winter Wolf (2014, CR 3)",
      "Wolf (2014, CR 1/4)",
      "Dire Wolf (2024, CR 1)",
      "Wolf (2024, CR 1/4)",
      "Fixture Werewolf Lord (Mine, CR 5)",
      "Wolf (Mine: Fixture Pack, CR 1/2)",
      "Goblin Warrior (2024, CR 1/4)",
      "Fixture Bare (Mine)",
    ]);
  });

  it("numbers lines that would read the same, so each finds its own creature", () => {
    const twins = [creature("Wolf", "srd-5.1"), creature("Wolf", "srd-5.1", { key: "other" })];
    const lines = creatureLines(twins);
    expect([...lines.keys()]).toEqual(["Wolf (2014)", "Wolf (2014) #2"]);
    expect(lines.get("Wolf (2014) #2")?.key).toBe("other");
  });
});

describe("statblockOfNote", () => {
  it("finds a vault note's statblock by its entity ID, never an SRD monster's", () => {
    expect(statblockOfNote(CREATURES, "Bestiary/Wolf")?.noteTitle).toBe("Fixture Pack");
    expect(statblockOfNote(CREATURES, "wolf")).toBeUndefined();
  });
});
