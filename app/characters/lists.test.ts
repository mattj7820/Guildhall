import { describe, expect, it } from "vitest";
import {
  applies,
  applyListChange,
  inverseListChange,
  setFields,
  type Edits,
  type ListChange,
} from "./lists";
import { aSpell } from "./test-builders";
import type { Spell } from "./types";

const apply = (list: Spell[], change: ListChange<Spell>) =>
  applyListChange(list, change, setFields<Spell>);
const names = (list: Spell[]) => list.map((spell) => spell.name);

const a = aSpell({ id: "a", name: "A" });
const b = aSpell({ id: "b", name: "B" });
const c = aSpell({ id: "c", name: "C" });

describe("applyListChange", () => {
  it("adds at the end, or where it's put", () => {
    expect(names(apply([a, b], { type: "add", item: c }))).toEqual(["A", "B", "C"]);
    expect(names(apply([a, b], { type: "add", item: c, index: 0 }))).toEqual(["C", "A", "B"]);
  });

  it("doesn't add the same thing twice, so a repeated request changes nothing", () => {
    const list = [a, b];
    expect(apply(list, { type: "add", item: aSpell({ id: "a", name: "Other" }) })).toBe(list);
  });

  it("edits only the fields named, and null clears an optional one", () => {
    const spell = aSpell({ id: "s", roll: "1d10", effect: "cold" });
    const [edited] = apply([spell], {
      type: "edit",
      id: "s",
      changes: { range: "120 ft.", effect: null },
    });
    expect(edited).toEqual({ ...spell, range: "120 ft.", effect: undefined });
    expect("effect" in edited).toBe(false);
  });

  it("removes, and moves within the list", () => {
    expect(names(apply([a, b, c], { type: "remove", id: "b" }))).toEqual(["A", "C"]);
    expect(names(apply([a, b, c], { type: "move", id: "a", index: 2 }))).toEqual(["B", "C", "A"]);
    expect(names(apply([a, b, c], { type: "move", id: "c", index: 99 }))).toEqual(["A", "B", "C"]);
  });

  it("puts something back exactly, where it was or in its old place", () => {
    const changed = aSpell({ ...a, name: "A changed" });
    expect(apply([changed, b], { type: "restore", item: a, index: 0 })).toEqual([a, b]);
    expect(names(apply([b, c], { type: "restore", item: a, index: 0 }))).toEqual(["A", "B", "C"]);
  });

  it("changes nothing for an edit, move or removal of something that's gone", () => {
    const list = [a];
    for (const change of [
      { type: "edit", id: "gone", changes: { name: "x" } },
      { type: "move", id: "gone", index: 0 },
      { type: "remove", id: "gone" },
    ] satisfies ListChange<Spell>[]) {
      expect(apply(list, change)).toBe(list);
      expect(applies(list, change)).toBe(false);
    }
  });
});

describe("inverseListChange", () => {
  /** Applies a change, then its inverse, and checks the list is as it was. */
  function roundTrip(before: Spell[], change: ListChange<Spell>) {
    const after = apply(before, change);
    const undone = inverseListChange(before, change).reduce(apply, after);
    expect(undone).toEqual(before);
  }

  it.each<[string, ListChange<Spell>]>([
    ["an add", { type: "add", item: c, index: 1 }],
    ["a removal", { type: "remove", id: "a" }],
    ["a move", { type: "move", id: "a", index: 1 }],
    ["an edit", { type: "edit", id: "b", changes: { name: "B2", save: "dex" } }],
    [
      "putting back a changed one",
      { type: "restore", item: aSpell({ ...a, name: "Old" }), index: 0 },
    ],
    ["putting back a missing one", { type: "restore", item: c, index: 0 }],
  ])("undoes %s", (_, change) => roundTrip([a, b], change));

  it("undoes an edit by putting back only the fields it changed, keeping others' edits", () => {
    const spell = aSpell({ id: "s", range: "60 ft.", duration: "Instant" });
    const mine: Edits<Spell> = { range: "120 ft." };
    const [inverse] = inverseListChange([spell], { type: "edit", id: "s", changes: mine });
    expect(inverse).toEqual({ type: "edit", id: "s", changes: { range: "60 ft." } });

    // Someone else changed the duration meanwhile: undoing mine leaves theirs.
    const theirs = apply(apply([spell], { type: "edit", id: "s", changes: mine }), {
      type: "edit",
      id: "s",
      changes: { duration: "1 minute" },
    });
    expect(apply(theirs, inverse)[0]).toMatchObject({ range: "60 ft.", duration: "1 minute" });
  });

  it("clears a field the edit set where there was none", () => {
    const [inverse] = inverseListChange([a], {
      type: "edit",
      id: "a",
      changes: { roll: "2d6" },
    });
    expect(inverse).toEqual({ type: "edit", id: "a", changes: { roll: null } });
  });

  it("is nothing for a change that changed nothing", () => {
    expect(inverseListChange([a], { type: "edit", id: "a", changes: { name: "A" } })).toEqual([]);
    expect(inverseListChange([a], { type: "add", item: a })).toEqual([]);
  });
});
