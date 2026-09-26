import { describe, expect, it } from "vitest";
import { ENCOUNTER_STORAGE_KEY, loadEncounter, saveEncounter } from "./storage";
import { inCombat, monster, player } from "./test-builders";

/** A stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const fight = inCombat(
  [
    player("Aria", {
      initiative: 18,
      tiebreaks: [4],
      conditions: ["prone"],
      note: "Fixture note",
      entityId: "Party/Aria",
      statblock: { entityId: "Bestiary/Dog", name: "Dog" },
    }),
    monster("Goblin 1", { initiative: 9, armorClass: 15, joinedRound: 2 }),
  ],
  "Aria",
  3,
);

describe("encounter storage", () => {
  it("restores exactly what was saved", () => {
    const storage = memoryStorage();
    expect(saveEncounter(storage, fight)).toBe(true);
    expect(loadEncounter(storage)).toEqual({ status: "restored", encounter: fight });
  });

  it("reports an empty store", () => {
    expect(loadEncounter(memoryStorage())).toEqual({ status: "empty" });
  });

  it.each([
    ["isn't JSON", "{not json"],
    ["is from another version", JSON.stringify({ ...fight, schemaVersion: 2 })],
    ["has a broken combatant", JSON.stringify({ ...fight, combatants: [{ kind: "dragon" }] })],
    [
      "has an unknown condition",
      JSON.stringify(inCombat([player("A", { conditions: ["hexed" as never] })], "A")),
    ],
    [
      "has negative HP",
      JSON.stringify(inCombat([monster("A", { hp: { current: -1, max: 5, temp: 0 } })], "A")),
    ],
  ])("reports saved data that %s as unreadable", (_label, raw) => {
    expect(loadEncounter(memoryStorage({ [ENCOUNTER_STORAGE_KEY]: raw }))).toEqual({
      status: "unreadable",
    });
  });

  it("doesn't throw when the browser blocks storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadEncounter(blocked)).toEqual({ status: "unreadable" });
    expect(saveEncounter(blocked, fight)).toBe(false);
  });
});
