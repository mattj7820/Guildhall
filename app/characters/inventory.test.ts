import { describe, expect, it } from "vitest";
import {
  addItem,
  canStack,
  moveItem,
  QUANTITY_MAX,
  removeItem,
  setEquipped,
  setQuantity,
  sortItems,
  splitItem,
  stackItem,
} from "./inventory";
import { anItem } from "./test-builders";

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("canStack", () => {
  it("stacks two of the same custom item", () => {
    expect(canStack(anItem({ name: "Torch" }), anItem({ name: " torch " }))).toBe(true);
  });

  it("stacks two of the same vault item", () => {
    expect(canStack(anItem({ note: "Items/Rope" }), anItem({ note: "Items/Rope" }))).toBe(true);
  });

  it.each([
    ["different names", { name: "Torch" }, { name: "Rope" }],
    ["one linked to a note", { note: "Items/Rope" }, {}],
    ["different notes", { note: "Items/Rope" }, { note: "Items/Silk Rope" }],
    ["different icons", { icon: { builtin: "rope" } }, { icon: { builtin: "bag" } }],
    ["different descriptions", { description: "Frayed" }, {}],
    ["different sources", { source: { text: "Session 1" } }, { source: { text: "Session 2" } }],
    [
      "different source notes",
      { source: { note: "Places/Inn" } },
      { source: { note: "Places/Mill" } },
    ],
    ["an equipped item", { equipped: true }, {}],
    ["an attuned target", {}, { attuned: true }],
  ])("keeps apart items with %s, so stacking never loses anything", (_, a, b) => {
    expect(canStack(anItem(a), anItem(b))).toBe(false);
  });

  it("doesn't stack an item onto itself", () => {
    const item = anItem();
    expect(canStack(item, item)).toBe(false);
  });
});

describe("moveItem", () => {
  const [a, b, c, d] = [
    anItem({ id: "a" }),
    anItem({ id: "b" }),
    anItem({ id: "c" }),
    anItem({ id: "d" }),
  ];

  it.each([
    ["forwards", "a", 2, ["b", "c", "a", "d"]],
    ["backwards", "d", 0, ["d", "a", "b", "c"]],
    ["past the end, to the end", "b", 99, ["a", "c", "d", "b"]],
  ])("moves an item %s", (_, id, index, expected) => {
    expect(ids(moveItem([a, b, c, d], id as string, index as number))).toEqual(expected);
  });

  it("returns the same list for a missing item or no move", () => {
    const items = [a, b];
    expect(moveItem(items, "gone", 0)).toBe(items);
    expect(moveItem(items, "a", 0)).toBe(items);
  });
});

describe("stackItem", () => {
  it("adds the quantity to the target, which keeps its place", () => {
    const items = [
      anItem({ id: "a", name: "Torch", quantity: 2 }),
      anItem({ id: "b" }),
      anItem({ id: "c", name: "Torch", quantity: 3 }),
    ];
    const stacked = stackItem(items, "c", "a");
    expect(ids(stacked)).toEqual(["a", "b"]);
    expect(stacked[0].quantity).toBe(5);
  });

  it("caps a stack at the largest quantity", () => {
    const items = [anItem({ id: "a", quantity: QUANTITY_MAX }), anItem({ id: "b", quantity: 5 })];
    expect(stackItem(items, "b", "a")[0].quantity).toBe(QUANTITY_MAX);
  });

  it("refuses items that don't stack, or have gone", () => {
    const items = [anItem({ id: "a" }), anItem({ id: "b", name: "Torch" })];
    expect(stackItem(items, "b", "a")).toBe(items);
    expect(stackItem(items, "gone", "a")).toBe(items);
  });
});

describe("splitItem", () => {
  it("takes some off into a new stack just after it", () => {
    const items = [anItem({ id: "a", quantity: 5, equipped: true }), anItem({ id: "b" })];
    const split = splitItem(items, "a", 2, "new");
    expect(ids(split)).toEqual(["a", "new", "b"]);
    expect(split.map((item) => item.quantity)).toEqual([3, 2, 1]);
    expect(split[1]).toMatchObject({ equipped: false, name: "Rope" });
  });

  it("can place the new stack elsewhere", () => {
    const items = [anItem({ id: "a", quantity: 4 }), anItem({ id: "b" })];
    expect(ids(splitItem(items, "a", 2, "new", 2))).toEqual(["a", "b", "new"]);
  });

  it.each([0, 5, 6, 1.5])("refuses to split off %s of 5", (amount) => {
    const items = [anItem({ id: "a", quantity: 5 })];
    expect(splitItem(items, "a", amount, "new")).toBe(items);
  });
});

describe("addItem", () => {
  it("stacks onto an identical item, as picking something up does in games", () => {
    const items = [anItem({ id: "a", name: "Torch", quantity: 2 })];
    const added = addItem(items, anItem({ id: "b", name: "Torch", quantity: 3 }));
    expect(ids(added)).toEqual(["a"]);
    expect(added[0].quantity).toBe(5);
  });

  it("otherwise adds it at the end, or where asked", () => {
    const items = [anItem({ id: "a" }), anItem({ id: "b" })];
    expect(ids(addItem(items, anItem({ id: "c", name: "Torch" })))).toEqual(["a", "b", "c"]);
    expect(ids(addItem(items, anItem({ id: "c", name: "Torch" }), 1))).toEqual(["a", "c", "b"]);
  });
});

describe("small changes", () => {
  it("removes an item, and returns the same list if it's gone already", () => {
    const items = [anItem({ id: "a" }), anItem({ id: "b" })];
    expect(ids(removeItem(items, "a"))).toEqual(["b"]);
    expect(removeItem(items, "gone")).toBe(items);
  });

  it.each([
    [0, 1],
    [2.6, 3],
    [QUANTITY_MAX + 1, QUANTITY_MAX],
  ])("keeps a quantity of %s whole and in range (%s)", (quantity, expected) => {
    expect(setQuantity([anItem({ id: "a" })], "a", quantity)[0].quantity).toBe(expected);
  });

  it("ends attunement when an item is unequipped", () => {
    const items = [anItem({ id: "a", equipped: true, attuned: true })];
    expect(setEquipped(items, "a", false)[0]).toMatchObject({ equipped: false, attuned: false });
    expect(setEquipped(items, "a", true)[0]).toMatchObject({ equipped: true, attuned: true });
  });

  it("sorts by name, or equipped items first", () => {
    const items = [
      anItem({ id: "torch", name: "torch" }),
      anItem({ id: "axe", name: "Axe" }),
      anItem({ id: "shield", name: "Shield", equipped: true }),
    ];
    expect(ids(sortItems(items, "name"))).toEqual(["axe", "shield", "torch"]);
    expect(ids(sortItems(items, "equipped"))).toEqual(["shield", "axe", "torch"]);
  });
});
