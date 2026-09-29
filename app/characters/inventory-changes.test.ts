import { describe, expect, it } from "vitest";
import {
  applyInventoryChange,
  describeChange,
  emptyPurse,
  NAME_MAX,
  PURSE_MAX,
  type InventoryState,
} from "./inventory-changes";
import { anItem } from "./test-builders";

function state(...items: ReturnType<typeof anItem>[]): InventoryState {
  return { items, purse: emptyPurse };
}

describe("applyInventoryChange", () => {
  it("returns the same state when nothing changes, so no empty undo step is recorded", () => {
    const before = state(anItem({ id: "a" }));
    expect(applyInventoryChange(before, { type: "remove", id: "gone" })).toBe(before);
    expect(applyInventoryChange(before, { type: "seen", id: "a" })).toBe(before);
    expect(applyInventoryChange(before, { type: "purse", coin: "gp", amount: 0 })).toBe(before);
  });

  it("splits a stack onto another identical stack", () => {
    const before = state(
      anItem({ id: "a", name: "Torch", quantity: 6 }),
      anItem({ id: "b", name: "Torch", quantity: 1, description: "Soaked" }),
      anItem({ id: "c", name: "Torch", quantity: 1 }),
    );
    const after = applyInventoryChange(before, {
      type: "split",
      id: "a",
      amount: 3,
      newId: "n",
      onto: "c",
    });
    expect(after.items.map((item) => [item.id, item.quantity])).toEqual([
      ["a", 3],
      ["b", 1],
      ["c", 4],
    ]);
  });

  it("equips an item when attuning to it", () => {
    const after = applyInventoryChange(state(anItem({ id: "a" })), {
      type: "attune",
      id: "a",
      attuned: true,
    });
    expect(after.items[0]).toMatchObject({ equipped: true, attuned: true });
  });

  it("tidies edits: trims text, drops empty text, never empties a name", () => {
    const after = applyInventoryChange(state(anItem({ id: "a", description: "Old" })), {
      type: "edit",
      id: "a",
      changes: {
        name: "   ",
        description: "  ",
        source: { text: `  ${"x".repeat(200)}` },
      },
    });
    expect(after.items[0].name).toBe("Rope");
    expect(after.items[0].description).toBeUndefined();
    expect(after.items[0].source?.text).toHaveLength(120);
  });

  it("caps long names", () => {
    const after = applyInventoryChange(state(anItem({ id: "a" })), {
      type: "edit",
      id: "a",
      changes: { name: "y".repeat(NAME_MAX + 10) },
    });
    expect(after.items[0].name).toHaveLength(NAME_MAX);
  });

  it("marks an item seen", () => {
    const after = applyInventoryChange(state(anItem({ id: "a", unseen: true })), {
      type: "seen",
      id: "a",
    });
    expect(after.items[0].unseen).toBe(false);
  });

  it.each([
    [-5, 0],
    [12.4, 12],
    [PURSE_MAX + 1, PURSE_MAX],
  ])("keeps coins whole and in range: %s → %s", (amount, expected) => {
    const after = applyInventoryChange(state(), { type: "purse", coin: "gp", amount });
    expect(after.purse.gp).toBe(expected);
  });
});

describe("describeChange", () => {
  const before = state(
    anItem({ id: "a", name: "Rope", quantity: 3 }),
    anItem({ id: "b", name: "Rope", quantity: 2 }),
  );

  it.each([
    [{ type: "remove", id: "a" }, "Removed Rope ×3"],
    [{ type: "stack", id: "b", onto: "a" }, "Stacked Rope ×5"],
    [{ type: "equip", id: "a", equipped: true }, "Equipped Rope"],
    [{ type: "add", item: anItem({ name: "Torch", quantity: 4 }) }, "Added Torch ×4"],
    [{ type: "purse", coin: "gp", amount: 12 }, "Changed gp to 12"],
  ] as const)("describes %j", (change, text) => {
    expect(describeChange(before, change)).toBe(text);
  });
});
