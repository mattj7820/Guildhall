import { expect, test } from "./fight-test";
import { Tracker } from "../pages/combat";
import { d20, d6, scriptDice } from "../support/dice";
import { REVEAL_ALL, uniqueName } from "../support/test-data";

/**
 * Fights started from tokens on the map: the DM gives markers a monster's statblock, picks them
 * (Shift-click, a Shift-drag box, or ticks), and starts a fight with them. Each stays the same
 * token, under its own name, and keeps its hit points after the fight. The fixture "Fixture
 * Minion" has 2d6 hit points.
 */

const MINION = "Fixture Minion (Mine, CR 1/8)";

test.describe("A fight from tokens on the map", () => {
  test("starts with the picked monsters under their own names, and keeps them after", async ({
    api,
    maps,
    page,
    openAs,
  }) => {
    const map = await api.createMap({
      name: uniqueName("Ambush"),
      shared: true,
      fog: [REVEAL_ALL],
    });
    const view = await maps.view(map);
    await view.addToken({ name: "Snaggle", monster: MINION, shown: true, at: [0.3, 0.5] });
    await view.addToken({ name: "Lurker", monster: MINION, shown: false, at: [0.7, 0.5] });
    await view.addToken({ name: "Signpost", shown: true, at: [0.5, 0.2] });
    await expect(view.onThisMap).toContainText("⚔ Fixture Minion");

    // Picked three ways; the signpost has no statblock, so it can't join.
    await view.shiftClickToken("Snaggle");
    await view.pickWithBox([0.6, 0.4], [0.8, 0.6]);
    await view.onThisMap.getByRole("checkbox", { name: "Pick Signpost" }).check();
    await expect(view.pickBar).toContainText("Signpost has no statblock");

    // Per monster, in the order they were placed: initiative d20, then 2d6 hit points.
    await scriptDice(page, [d20(15), d6(3), d6(4), d20(5), d6(6), d6(6)]);
    await view.pickBar.getByRole("button", { name: "Start a fight with 2" }).click();
    const tracker = new Tracker(page);
    await expect(tracker.combatant("Snaggle")).toContainText("HP 7/7");
    await expect(tracker.combatant("Lurker")).toContainText("HP 12/12");
    await tracker.saved();
    // The same tokens: still theirs, and the DM-only one joined hidden.
    await expect(view.token("Snaggle")).toHaveAccessibleName(/7 of 7 HP/);
    await expect(view.token("Lurker")).toHaveAccessibleName(/players can't see this/);

    const player = await openAs("playerOne");
    const theirs = await player.maps.view(map);
    await theirs.live();
    await expect(theirs.anyTokenNamed("Snaggle")).toBeVisible();
    await expect(theirs.anyTokenNamed("Lurker")).toHaveCount(0);
    // Showing the marker reveals its monster: one switch.
    await view.openTokens();
    await view.toggleShown("Lurker", "show");
    await expect(theirs.anyTokenNamed("Lurker")).toBeVisible();
    await page.getByRole("tab", { name: "Fight" }).click();
    await tracker.saved();

    // Left on the map, they keep their hit points, to join the next fight with.
    await tracker.damage("Snaggle", 2);
    await tracker.saved();
    await view.endFight("Leave them on the map");
    await expect(view.token("Snaggle")).toHaveAccessibleName(/5 of 7 HP/);
    await expect(tracker.turnOrder).toHaveCount(0);

    await view.shiftClickToken("Snaggle");
    await scriptDice(page, [d20(10)]);
    await view.pickBar.getByRole("button", { name: "Start a fight with 1" }).click();
    await expect(tracker.combatant("Snaggle")).toContainText("HP 5/7");
    await tracker.saved();

    // Cleared at the end: only the one in the fight goes.
    await view.endFight("Clear the monsters");
    await expect(view.anyTokenNamed("Snaggle")).toHaveCount(0);
    await expect(view.token("Lurker")).toBeVisible();
  });
});
