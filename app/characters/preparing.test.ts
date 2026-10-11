import { describe, expect, it } from "vitest";
import { applyAction } from "./actions";
import {
  alwaysReady,
  canPrepare,
  isReady,
  overPrepared,
  prepareAction,
  preparedCount,
  startsPrepared,
} from "./preparing";
import { aCharacter, aSheet, aSpell } from "./test-builders";
import type { Character, PlayerCharacter, Sheet } from "./types";

const sheetOf = (character: Character) => (character as PlayerCharacter).sheet;

const cantrip = aSpell({ id: "cantrip", level: 0, prepared: false });
const free = aSpell({ id: "free", level: 1, freeUse: "feat", prepared: false });
const ready = aSpell({ id: "ready", level: 1, prepared: true });
const waiting = aSpell({ id: "waiting", level: 2, prepared: false });

const sheet = (fields: Partial<Sheet> = {}): Sheet => ({
  ...aSheet(),
  spells: [cantrip, free, ready, waiting],
  ...fields,
});

describe("what's ready", () => {
  it("keeps cantrips and free spells ready, whatever their flag says", () => {
    expect(alwaysReady(cantrip)).toBe(true);
    expect(alwaysReady(free)).toBe(true);
    expect(isReady(cantrip)).toBe(true);
    expect(isReady(free)).toBe(true);
  });

  it("makes other spells ready only when prepared", () => {
    expect(alwaysReady(ready)).toBe(false);
    expect(isReady(ready)).toBe(true);
    expect(isReady(waiting)).toBe(false);
  });

  it("treats a spell that loses its free use like any other", () => {
    const { freeUse: _, ...plain } = free;
    expect(isReady(plain)).toBe(false);
  });
});

describe("counting", () => {
  it("counts only prepared spells that aren't always ready", () => {
    const all = sheet({
      spells: [{ ...cantrip, prepared: true }, { ...free, prepared: true }, ready, waiting],
    });
    expect(preparedCount(all)).toBe(1);
  });

  it("says how many are over the number, and nothing without one", () => {
    const two = sheet({ spells: [ready, { ...waiting, prepared: true }] });
    expect(overPrepared({ ...two, spellsToPrepare: 1 })).toBe(1);
    expect(overPrepared({ ...two, spellsToPrepare: 2 })).toBe(0);
    expect(overPrepared({ ...two, spellsToPrepare: 3 })).toBe(0);
    expect(overPrepared(two)).toBe(0);
  });

  it("offers preparing only when some spell can be prepared", () => {
    expect(canPrepare(sheet())).toBe(true);
    expect(canPrepare(sheet({ spells: [cantrip, free] }))).toBe(false);
  });
});

describe("a new spell", () => {
  it("starts prepared for a character who doesn't prepare", () => {
    expect(startsPrepared(sheet())).toBe(true);
  });

  it("starts prepared while there's room under the number, and not once it's reached", () => {
    expect(startsPrepared(sheet({ spellsToPrepare: 2 }))).toBe(true);
    expect(startsPrepared(sheet({ spellsToPrepare: 1 }))).toBe(false);
    expect(startsPrepared(sheet({ spellsToPrepare: 0, spells: [] }))).toBe(false);
  });
});

describe("preparing a spell", () => {
  const character = aCharacter({ sheet: sheet() });

  it("changes only that spell's flag", () => {
    const result = applyAction(character, prepareAction(waiting, true));
    expect(result.outcome).toBe("changed");
    const spells = sheetOf(result.character).spells;
    expect(spells.find((spell) => spell.id === "waiting")).toEqual({ ...waiting, prepared: true });
    expect(spells.filter((spell) => spell.id !== "waiting")).toEqual([cantrip, free, ready]);
  });

  it("changes nothing when it's already so", () => {
    expect(applyAction(character, prepareAction(ready, true)).outcome).toBe("unchanged");
  });

  it("is dropped for a spell that's gone", () => {
    const gone = aSpell({ id: "gone" });
    expect(applyAction(character, prepareAction(gone, true)).outcome).toBe("dropped");
  });
});

describe("spells to prepare", () => {
  const character = aCharacter({ sheet: sheet({ spellsToPrepare: 2 }) });

  it("is typed, and cleared for a character who doesn't prepare", () => {
    const typed = applyAction(character, { type: "spellsToPrepare", value: 3, from: 2 });
    expect(typed).toMatchObject({ outcome: "changed" });
    expect(typed.replaced).toBeUndefined();
    expect(sheetOf(typed.character).spellsToPrepare).toBe(3);
    const cleared = applyAction(typed.character, { type: "spellsToPrepare", from: 3 });
    expect(sheetOf(cleared.character)).not.toHaveProperty("spellsToPrepare");
  });

  it("wins over a number typed elsewhere since, and says what it replaced", () => {
    const result = applyAction(character, { type: "spellsToPrepare", value: 4, from: 1 });
    expect(result).toMatchObject({ outcome: "changed", replaced: 2 });
    expect(sheetOf(result.character).spellsToPrepare).toBe(4);
  });
});
