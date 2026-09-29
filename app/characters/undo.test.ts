import { describe, expect, it } from "vitest";
import { applyAction, applyActions, type CharacterAction } from "./actions";
import { aCharacter, aCompanion, anItem, aSheet } from "./test-builders";
import type { Character } from "./types";
import { emptyUndo, inverseOf, remember, revertInventory, takeStep } from "./undo";

/** A character with something in every part, so undo has something to put back. */
const before: Character = aCharacter({
  sheet: aSheet({
    name: "Kit",
    abilities: { str: 8, dex: 16, con: 12, int: 10, wis: 13, cha: 14 },
    skills: { ...aSheet().skills, stealth: "proficient" },
    overrides: { "skill.perception": 4 },
    hp: { current: 12, max: 20, temp: 3 },
    portrait: "Art/Kit.png",
  }),
  items: [
    anItem({ id: "rope", name: "Rope" }),
    anItem({ id: "t1", name: "Torch", icon: { builtin: "torch" }, quantity: 3 }),
    anItem({ id: "t2", name: "Torch", icon: { builtin: "torch" }, quantity: 2 }),
    anItem({ id: "ring", name: "Ring", equipped: true, attuned: true, unseen: true }),
  ],
});

const inventory = (change: Extract<CharacterAction, { type: "inventory" }>["change"]) =>
  ({ type: "inventory", change }) as const;

describe("inverseOf", () => {
  it.each<[string, CharacterAction]>([
    ["a text field", { type: "text", field: "name", value: "Kitty" }],
    ["an ability score", { type: "ability", ability: "dex", value: 18 }],
    ["a skill", { type: "skill", skill: "stealth", value: "expertise" }],
    ["adding an override", { type: "override", key: "initiative", value: 7 }],
    ["clearing an override", { type: "override", key: "skill.perception" }],
    ["clearing the portrait", { type: "portrait" }],
    ["inspiration", { type: "inspiration", value: true }],
    ["damage through temporary hit points", { type: "damage", amount: 5 }],
    ["healing", { type: "heal", amount: 4 }],
    ["lowering the maximum hit points", { type: "hp", field: "max", value: 5 }],
    ["adding an item", inventory({ type: "add", item: anItem({ id: "new", name: "Map" }) })],
    ["adding onto a stack", inventory({ type: "add", item: anItem({ id: "new", name: "Rope" }) })],
    ["moving an item", inventory({ type: "move", id: "rope", index: 3 })],
    ["stacking", inventory({ type: "stack", id: "t2", onto: "t1" })],
    ["splitting", inventory({ type: "split", id: "t1", amount: 1, newId: "t3", index: 0 })],
    [
      "splitting onto a stack",
      inventory({ type: "split", id: "t1", amount: 1, newId: "t3", onto: "t2" }),
    ],
    ["removing an item", inventory({ type: "remove", id: "t1" })],
    [
      "unequipping, which ends attunement",
      inventory({ type: "equip", id: "ring", equipped: false }),
    ],
    ["looking at a new item", inventory({ type: "seen", id: "ring" })],
    [
      "editing an item",
      inventory({ type: "edit", id: "rope", changes: { description: "Frayed" } }),
    ],
    ["sorting", inventory({ type: "sort", order: "name" })],
    ["coins", inventory({ type: "purse", coin: "gp", amount: 40 })],
  ])("puts back %s exactly", (_, action) => {
    const { character: after, outcome } = applyAction(before, action);
    expect(outcome).toBe("changed");
    const undone = applyActions(after, inverseOf(before, action)).character;
    expect(undone).toEqual(before);
  });

  it("is empty for an action that changed nothing", () => {
    expect(inverseOf(before, { type: "text", field: "name", value: "Kit" })).toEqual([]);
    expect(inverseOf(before, inventory({ type: "remove", id: "gone" }))).toEqual([]);
  });

  it("carries what it expects to find, so undoing over someone's newer edit is reported", () => {
    const [inverse] = inverseOf(before, { type: "ability", ability: "dex", value: 18 });
    expect(inverse).toEqual({ type: "ability", ability: "dex", value: 16, from: 18 });
  });

  it("puts back a companion's hit points", () => {
    const companion = aCompanion();
    const action: CharacterAction = { type: "damage", amount: 9 };
    const after = applyAction(companion, action).character;
    expect(applyActions(after, inverseOf(companion, action)).character).toEqual(companion);
  });

  it("leaves other people's changes alone when undoing", () => {
    const mine: CharacterAction = inventory({ type: "remove", id: "rope" });
    const afterMine = applyAction(before, mine).character;
    // Meanwhile the DM changes the torches and the coins.
    const afterDm = applyActions(afterMine, [
      inventory({ type: "quantity", id: "t1", quantity: 9 }),
      inventory({ type: "purse", coin: "gp", amount: 100 }),
    ]).character;

    const undone = applyActions(afterDm, inverseOf(before, mine)).character;
    expect(undone.inventory.items.map((item) => item.id)).toEqual(["rope", "t1", "t2", "ring"]);
    expect(undone.inventory.items[1].quantity).toBe(9);
    expect(undone.inventory.purse.gp).toBe(100);
  });
});

describe("revertInventory", () => {
  it("does nothing when nothing changed", () => {
    expect(revertInventory(before.inventory, before.inventory)).toEqual([]);
  });
});

describe("the undo stack", () => {
  it("undoes, then redoes, then undoes again", () => {
    const action: CharacterAction = { type: "ability", ability: "str", value: 10 };
    const after = applyAction(before, action).character;
    const stack = remember(emptyUndo, inverseOf(before, action));

    const undo = takeStep(stack, "undo", after)!;
    const undone = applyActions(after, undo.actions).character;
    expect(undone).toEqual(before);
    expect(undo.stack.undo).toEqual([]);

    const redo = takeStep(undo.stack, "redo", undone)!;
    const redone = applyActions(undone, redo.actions).character;
    expect(redone).toEqual(after);

    const again = takeStep(redo.stack, "undo", redone)!;
    expect(applyActions(redone, again.actions).character).toEqual(before);
  });

  it("forgets what was undone once something new is changed", () => {
    const stack = { undo: [], redo: [[{ type: "heal", amount: 1 } as CharacterAction]] };
    expect(remember(stack, [{ type: "heal", amount: 2 }]).redo).toEqual([]);
  });

  it("has nothing to undo at the start", () => {
    expect(takeStep(emptyUndo, "undo", before)).toBeUndefined();
  });
});
