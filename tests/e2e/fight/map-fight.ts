import { expect, test as base } from "./fight-test";
import { Tracker } from "../pages/combat";
import type { MapView } from "../pages/maps";
import { d20, d6, scriptDice } from "../support/dice";
import { REVEAL_ALL, uniqueName } from "../support/test-data";

/**
 * A fight run from a map page: Combat opens the tracker beside the map; monsters joining are
 * placed with a click, and their tokens follow the fight. The fixture "Fixture Minion" is Small
 * (one square) with 2d6 hit points.
 */

const test = base.extend<{ arena: MapView }>({
  /** A shared map of the fog fixture, all revealed, open with Combat beside it. */
  arena: async ({ api, maps }, use) => {
    const map = await api.createMap({ name: uniqueName("Arena"), shared: true, fog: [REVEAL_ALL] });
    const view = await maps.view(map);
    await view.openCombat();
    await use(view);
  },
});

/** Two minions, placed side by side from the middle of the map, then the fight started. */
async function twoMinionsPlaced(arena: MapView) {
  const tracker = new Tracker(arena.page);
  // Per monster: initiative d20, then 2d6 hit points.
  await scriptDice(arena.page, [d20(15), d6(3), d6(4), d20(5), d6(6), d6(6)]);
  await tracker.addMonsters("Fixture Minion", 2);
  await expect(arena.placing).toHaveText(
    "Click the map to place Fixture Minion 1, Fixture Minion 2",
  );
  await arena.canvas.click();
  await expect(arena.anyTokenNamed("Fixture Minion 1")).toHaveAccessibleName(/7 of 7 HP/);
  await expect(arena.anyTokenNamed("Fixture Minion 2")).toBeVisible();
  await tracker.start();
  await tracker.saved();
  return tracker;
}

test.describe("A fight on a map", () => {
  test("places monsters, rings whose turn it is, and shows players what they may see", async ({
    arena,
    openAs,
  }) => {
    const tracker = await twoMinionsPlaced(arena);
    const minion = (view: MapView, n: number) => view.anyTokenNamed(`Fixture Minion ${n}`);
    await expect(tracker.whoseTurn).toHaveText("Round 1 · Fixture Minion 1's turn");

    // An ambusher: hidden from players, in the turn order and on the map.
    await tracker.toggleHidden("Fixture Minion 2");
    await expect(minion(arena, 2)).toHaveAccessibleName(/players can't see this/);
    await tracker.saved();

    const player = await openAs("playerOne");
    const theirs = await player.maps.view(arena.map);
    await theirs.live();
    await expect(player.combat.tracker.whoseTurn).toHaveText("Round 1 · Fixture Minion 1's turn");
    await expect(minion(theirs, 1)).toBeVisible();
    // No hit points for players.
    await expect(minion(theirs, 1)).not.toHaveAccessibleName(/HP/);
    await expect(minion(theirs, 2)).toHaveCount(0);
    await expect(player.combat.turnStrip).toHaveCount(1);

    // Down at 0, for everyone, live.
    await tracker.damage("Fixture Minion 1", 7);
    await expect(minion(arena, 1)).toHaveAccessibleName(/down, 0 of 7 HP/);
    await expect(minion(theirs, 1)).toHaveAccessibleName(/down/);

    // Revealed: the ambusher appears for players.
    await tracker.toggleHidden("Fixture Minion 2");
    await expect(minion(theirs, 2)).toBeVisible();
  });

  test("lets players move any time with Free movement, kept on reload", async ({
    api,
    arena,
    page,
  }) => {
    await twoMinionsPlaced(arena);
    const free = page.getByRole("checkbox", { name: /Free movement/ });
    await expect(free).not.toBeChecked();
    await free.check();
    await expect(page.getByText("players move any time")).toBeVisible();
    await expect.poll(async () => (await api.fight()).freeMovement).toBe(true);
    // The fight is on this map, so its page opens in Combat.
    await arena.reload();
    await expect(arena.combatButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: /Free movement/ })).toBeChecked();
  });

  test("damages or heals the monsters picked on the map, all at once", async ({ arena, page }) => {
    const tracker = await twoMinionsPlaced(arena);
    // Minion 1 has 7 HP, Minion 2 has 12.
    await arena.anyTokenNamed("Fixture Minion 1").click();
    await arena.anyTokenNamed("Fixture Minion 2").click({ modifiers: ["Shift"] });
    const panel = page.getByRole("form", { name: "Damage the picked monsters" });
    await expect(panel).toContainText("Fixture Minion 1, Fixture Minion 2");

    // A fireball's 5, halved for both: they saved.
    await panel.getByLabel("Amount").fill("5");
    await panel.getByRole("button", { name: "Half" }).click();
    await expect(tracker.combatant("Fixture Minion 1")).toContainText("HP 5/7");
    await expect(tracker.combatant("Fixture Minion 2")).toContainText("HP 10/12");

    // A click without Shift picks just the one.
    await arena.anyTokenNamed("Fixture Minion 2").click();
    await expect(panel).not.toContainText("Fixture Minion 1");
    await panel.getByLabel("Amount").fill("4");
    await panel.getByRole("button", { name: "Heal" }).click();
    await expect(tracker.combatant("Fixture Minion 2")).toContainText("HP 12/12");
    await tracker.undo();
    await expect(tracker.combatant("Fixture Minion 2")).toContainText("HP 10/12");
  });

  test("keeps a monster taken out of the fight on the map, with its hit points", async ({
    arena,
  }) => {
    const tracker = await twoMinionsPlaced(arena);
    await tracker
      .combatant("Fixture Minion 2")
      .getByRole("button", { name: "Remove Fixture Minion 2" })
      .click();
    await expect(tracker.combatant("Fixture Minion 2")).toHaveCount(0);
    // A marker now, out of the fight, keeping the hit points to join another with.
    await expect(arena.anyTokenNamed("Fixture Minion 2")).toHaveAccessibleName(/12 of 12 HP/);
    await expect(arena.anyTokenNamed("Fixture Minion 1")).toBeVisible();
  });

  test("ends the fight, clearing the monsters or leaving them on the map", async ({
    api,
    arena,
  }) => {
    const tracker = await twoMinionsPlaced(arena);
    const minion = (n: number) => arena.anyTokenNamed(`Fixture Minion ${n}`);
    await tracker.toggleHidden("Fixture Minion 2");
    await tracker.saved();

    await arena.endFight("Leave them on the map");
    // Markers out of the fight: keeping their hit points, and the hidden one still hidden.
    await expect(minion(1)).toHaveAccessibleName(/7 of 7 HP/);
    await expect(minion(2)).toHaveAccessibleName(/players can't see this/);
    expect(await api.fight()).toBeNull();

    // A new fight, cleared at the end.
    await arena.combatButton.click();
    await expect(tracker.turnOrder).toHaveCount(0);
    await scriptDice(arena.page, [d20(15), d6(3), d6(4)]);
    await tracker.addMonsters("Fixture Minion", 1);
    await expect(arena.placing).toBeVisible();
    await arena.canvas.click();
    await expect(minion(1)).toHaveCount(2);
    await tracker.saved();
    await arena.endFight("Clear the monsters");
    await expect(minion(1)).toHaveCount(1);
  });

  test("prepares a fight on a map, and starts it there with the monsters in place", async ({
    arena,
    page,
    prepared,
  }) => {
    const tracker = new Tracker(page);
    await scriptDice(page, [d6(3), d6(4), d6(6), d6(6)]);
    await tracker.addMonsters("Fixture Minion", 2);
    await expect(arena.placing).toBeVisible();
    await arena.canvas.click();
    const placed = arena.anyTokenNamed("Fixture Minion 2");
    await expect(placed).toBeVisible();
    const placedAt = await placed.getAttribute("aria-label");

    const encounterName = uniqueName("Ambush");
    await tracker.saveAsPrepared(encounterName);
    await arena.endFight("Clear the monsters");
    await expect(placed).toHaveCount(0);

    await prepared.open();
    await expect(page.getByRole("listitem").filter({ hasText: encounterName })).toContainText(
      `Set up on ${arena.map.name}`,
    );
    await page.getByRole("link", { name: `Start ${encounterName}` }).click();
    await page.waitForURL((current) => current.searchParams.has("start"));
    expect(new URL(page.url()).pathname).toBe(arena.map.url);
    const panel = prepared.startPanel(encounterName);
    await panel.getByRole("button", { name: "Add to tracker" }).click();

    await expect(page).not.toHaveURL(/start=/);
    // Where it was put, with the hit points it was prepared with.
    await expect(placed).toHaveAttribute("aria-label", placedAt!);
    await expect(tracker.combatant("Fixture PC One")).toBeVisible();
    // The party comes in with a click, from wherever they are.
    await page.getByRole("button", { name: "Bring the party here" }).click();
    await expect(arena.placing).toHaveText(/the whole party/);
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});
