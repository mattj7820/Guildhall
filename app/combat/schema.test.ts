import { describe, expect, it } from "vitest";
import { encounterSchema } from "./schema";
import { statblockKey } from "./types";

/**
 * A fight as Guildhall stored it before the SRD's monsters came, written out by hand. Stored data
 * is live, so it must load exactly as it was.
 */
const BEFORE_THE_SRD = {
  schemaVersion: 1,
  id: "enc-1",
  phase: "active",
  round: 2,
  activeId: "m-1",
  combatants: [
    {
      kind: "monster",
      id: "m-1",
      name: "Fixture Minion 1",
      initiative: 14,
      tiebreaks: [],
      conditions: ["prone"],
      note: "",
      statblock: { entityId: "Bestiary/Fixture Minion", name: "Fixture Minion" },
      initiativeBonus: 2,
      armorClass: 13,
      hp: { current: 4, max: 7, temp: 0 },
    },
    {
      kind: "player",
      id: "p-1",
      name: "Fixture Companion",
      initiative: 12,
      tiebreaks: [],
      conditions: [],
      note: "",
      controller: { id: "", name: "the party" },
      entityId: "Bestiary/Fixture Companion",
      statblock: { entityId: "Bestiary/Fixture Companion", name: "Fixture Companion" },
    },
  ],
};

const srdWolf = { entityId: "wolf", name: "Wolf", source: "srd-5.2" } as const;

describe("encounterSchema and the SRD", () => {
  it("loads a fight stored before the SRD unchanged, and writes it back the same", () => {
    const loaded = encounterSchema.parse(structuredClone(BEFORE_THE_SRD));
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(BEFORE_THE_SRD);
  });

  it("keeps a vault ref pointing at the vault", () => {
    const loaded = encounterSchema.parse(structuredClone(BEFORE_THE_SRD));
    const ref = loaded.combatants[0].statblock!;
    expect(statblockKey(ref)).toBe("Bestiary/Fixture Minion#Fixture Minion");
  });

  it("keeps an SRD monster's ref, with its source", () => {
    const fight = structuredClone(BEFORE_THE_SRD);
    fight.combatants[0].statblock = srdWolf;
    const ref = encounterSchema.parse(fight).combatants[0].statblock!;
    expect(ref).toEqual(srdWolf);
    expect(statblockKey(ref)).toBe("srd-5.2:wolf");
  });

  it("reads a source it doesn't know (from a later version) rather than refusing the fight", () => {
    const fight = structuredClone(BEFORE_THE_SRD);
    fight.combatants[0].statblock = { entityId: "wolf", name: "Wolf", source: "srd-6.0" } as never;
    const loaded = encounterSchema.safeParse(fight);
    expect(loaded.success).toBe(true);
    expect(loaded.data?.combatants[0].statblock?.source).toBeUndefined();
  });
});
