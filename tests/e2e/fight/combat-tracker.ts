import { expect, test } from "./fight-test";
import type { Combat } from "../pages/combat";
import { d20, d6, scriptDice } from "../support/dice";

/**
 * The combat tracker over the fixture vault. "Fixture Minion" has DEX 14 (+2 initiative) and 2d6
 * hit dice; the party is "Fixture PC One" (Player One) and "Fixture PC Two" (Player Two). Dice
 * are scripted, so every roll is known.
 */

/** Two minions (initiative 12 and 7; 7 and 12 HP) and the party, with no ties. */
async function buildEncounter(combat: Combat) {
  const { tracker } = combat;
  await combat.open();
  // Per monster: initiative d20, then 2d6 hit points.
  await scriptDice(combat.page, [d20(10), d6(3), d6(4), d20(5), d6(6), d6(6)]);
  await tracker.addMonsters("Fixture Minion", 2);
  await expect(tracker.combatant("Fixture Minion 2")).toBeVisible();
  await tracker.addPartyMember("Fixture PC One");
  await tracker.addPartyMember("Fixture PC Two");
  await tracker.setInitiative("Fixture PC One", 18);
  await tracker.setInitiative("Fixture PC Two", 9);
  await expect.poll(() => tracker.orderOfPlay()).toHaveLength(4);
  return tracker;
}

test.describe("Combat tracker", () => {
  test("builds an encounter from a vault statblock and orders it by initiative", async ({
    combat,
  }) => {
    const tracker = await buildEncounter(combat);

    await expect
      .poll(() => tracker.orderOfPlay())
      .toEqual(["Fixture PC One", "Fixture Minion 1", "Fixture PC Two", "Fixture Minion 2"]);
    const minion = tracker.combatant("Fixture Minion 1");
    await expect(minion.getByLabel(/Initiative/)).toHaveValue("12");
    await expect(minion).toContainText("HP 7/7");
    await expect(minion).toContainText("AC 13");
    await expect(tracker.combatant("Fixture Minion 2")).toContainText("HP 12/12");
    await expect(tracker.combatant("Fixture PC One")).toContainText("Player One");
  });

  test("breaks an initiative tie between a monster and a player with rerolls", async ({
    combat,
    page,
  }) => {
    const tracker = await buildEncounter(combat);
    const start = page.getByRole("button", { name: "Start combat" });
    const ties = page.getByRole("region", { name: "Ties to break" });

    // PC Two ties Minion 1 on 12: the minion rerolls by itself, the player is asked for theirs.
    await scriptDice(page, [d20(11)]);
    await tracker.setInitiative("Fixture PC Two", 12);
    await expect(ties).toContainText("Tied on 12: Fixture Minion 1 (rerolled 11), Fixture PC Two");
    await expect(start).toBeDisabled();

    // The rerolls tie again, so both go again.
    await scriptDice(page, [d20(4)]);
    await ties.getByLabel("Reroll for Fixture PC Two").fill("11");
    await ties.getByRole("button", { name: "Save reroll" }).click();
    await expect(ties).toContainText("Fixture Minion 1 (rerolled 11, 4)");

    await ties.getByLabel("Reroll for Fixture PC Two").fill("9");
    await ties.getByRole("button", { name: "Save reroll" }).click();

    await expect(ties).toHaveCount(0);
    await expect(start).toBeEnabled();
    await expect
      .poll(() => tracker.orderOfPlay())
      .toEqual(["Fixture PC One", "Fixture PC Two", "Fixture Minion 1", "Fixture Minion 2"]);
  });

  test("runs turns and rounds, tracks monster HP and survives a reload", async ({
    combat,
    page,
  }) => {
    const tracker = await buildEncounter(combat);
    await tracker.start();
    await expect(tracker.turnStatus).toContainText("Round 1 · Fixture PC One's turn");

    await tracker.nextTurn();
    await expect(tracker.turnStatus).toContainText("Fixture Minion 1's turn");
    // The statblock follows the monster whose turn it is.
    await expect(
      page.getByRole("region", { name: "Statblock: Fixture Minion", exact: true }),
    ).toBeVisible();

    const minion = tracker.combatant("Fixture Minion 1");
    await tracker.damage("Fixture Minion 1", 4);
    await expect(minion).toContainText("HP 3/7");
    await expect(minion).toContainText("Bloodied");

    await minion.getByLabel("Amount for Fixture Minion 1").fill("5");
    await minion.getByLabel("Amount for Fixture Minion 1").press("Enter");
    await expect(minion).toContainText("HP 0/7");
    await expect(minion).toContainText("Down");

    await minion.getByLabel("Add condition to Fixture Minion 1").selectOption("prone");
    await expect(
      minion.getByRole("button", { name: "Remove prone from Fixture Minion 1" }),
    ).toBeVisible();

    // Minion 1 is down, so after Minion 2 and a new round, play skips it. Each turn waits for
    // the last to show, so no click lands on a button that's about to change.
    for (const turn of [
      "Round 1 · Fixture PC Two's turn",
      "Round 1 · Fixture Minion 2's turn",
      "Round 2 · Fixture PC One's turn",
      "Round 2 · Fixture PC Two's turn",
      "Round 2 · Fixture Minion 2's turn",
    ]) {
      await tracker.nextTurn();
      await expect(tracker.turnStatus).toContainText(turn);
    }

    await tracker.saved();
    await combat.reload();
    await expect(tracker.turnStatus).toContainText("Round 2 · Fixture Minion 2's turn");
    await expect(minion).toContainText("HP 0/7");
    await expect(minion).toContainText("prone");
  });

  test("undoes the last change", async ({ combat }) => {
    const tracker = await buildEncounter(combat);
    const minion = tracker.combatant("Fixture Minion 2");
    await tracker.damage("Fixture Minion 2", 5);
    await expect(minion).toContainText("HP 7/12");

    await tracker.undo();
    await expect(minion).toContainText("HP 12/12");
  });

  test("starts a new encounter, which undo can bring back", async ({ combat, page }) => {
    const tracker = await buildEncounter(combat);
    await page.getByRole("button", { name: "New encounter" }).click();
    await expect(tracker.turnOrder).toHaveCount(0);

    await tracker.undo();
    await expect(tracker.combatant("Fixture PC One")).toBeVisible();
  });

  test("adds a companion controlled by a player, linked to its statblock", async ({
    combat,
    page,
  }) => {
    await combat.open();
    const { tracker } = combat;
    await tracker.addCompanion("Player Two", "Fixture Companion");

    const companion = tracker.combatant("Fixture Companion");
    await expect(companion).toContainText("Companion · Player Two");
    await tracker.showStatblock("Fixture Companion");
    await expect(
      page.getByRole("region", { name: "Statblock: Fixture Companion", exact: true }),
    ).toBeVisible();
  });

  test("adds the party's shared companion in one click, with its statblock", async ({
    combat,
    page,
  }) => {
    await combat.open();
    const { tracker } = combat;
    await expect(page.getByText("the whole party's")).toBeVisible();
    await tracker.addPartyMember("Fixture Companion");

    await expect(tracker.combatant("Fixture Companion")).toContainText("Companion · the party");
    await tracker.showStatblock("Fixture Companion");
    await expect(
      page.getByRole("region", { name: "Statblock: Fixture Companion", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Fixture Companion" })).toHaveCount(0);
  });

  test("keeps the fight on the server: another tab sees each change as it's made", async ({
    combat,
    openAs,
  }) => {
    const tracker = await buildEncounter(combat);
    await tracker.saved();
    const other = (await openAs("dm")).combat;
    await other.open();
    await expect(other.tracker.combatant("Fixture Minion 2")).toBeVisible();

    await tracker.start();
    await expect(other.tracker.turnStatus).toContainText("Round 1 · Fixture PC One's turn");
    await other.tracker.nextTurn();
    await expect(tracker.turnStatus).toContainText("Fixture Minion 1's turn");
  });

  test("lets a player end their own turn, and no one else's", async ({ combat, openAs }) => {
    const tracker = await buildEncounter(combat);
    await tracker.start();
    await tracker.saved();
    const player = await openAs("playerOne");
    const endTurn = () => player.api.post("/combat/fight", { intent: "endTurn" });

    // Fixture PC One (Player One) goes first: theirs to end.
    expect((await endTurn()).status()).toBe(200);
    await expect(tracker.turnStatus).toContainText("Fixture Minion 1's turn");
    // The minion's turn isn't.
    expect((await endTurn()).status()).toBe(409);
    await expect(tracker.turnStatus).toContainText("Fixture Minion 1's turn");
    // Nor can a player save the fight.
    expect((await player.api.post("/combat/fight", { intent: "end" })).status()).toBe(404);
  });

  test("brings over a fight this browser kept from before, once", async ({ combat, page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "yes");
      localStorage.setItem(
        "guildhall:encounter",
        JSON.stringify({
          schemaVersion: 1,
          id: "old",
          phase: "setup",
          round: 0,
          activeId: null,
          combatants: [
            {
              kind: "player",
              id: "kept",
              name: "Kept from before",
              initiative: null,
              tiebreaks: [],
              conditions: [],
              note: "",
              controller: { id: "player one", name: "Player One" },
            },
          ],
        }),
      );
    });
    await combat.open();
    const { tracker } = combat;
    await page.getByRole("button", { name: "Bring it over" }).click();
    await expect(tracker.combatant("Kept from before")).toBeVisible();
    await tracker.saved();
    await combat.reload();
    await expect(tracker.combatant("Kept from before")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bring it over" })).toHaveCount(0);
  });

  test("rolls dice expressions with advantage", async ({ combat, page }) => {
    await combat.open();
    await page.getByLabel("Dice to roll").fill("1d20+2");
    await page.getByLabel("Advantage", { exact: true }).check();
    await scriptDice(page, [d20(6), d20(17)]);
    await page.getByRole("button", { name: "Roll", exact: true }).click();

    await expect(combat.tracker.latestRoll).toContainText("19");
  });

  test("explains a dice expression it can't read", async ({ combat, page }) => {
    await combat.open();
    await page.getByLabel("Dice to roll").fill("fireball");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Couldn't read");
  });

  test("players get Combat in the menu, and see when there's no fight", async ({ app, page }) => {
    await app.goto("/");
    await app.previewAsPlayer();
    await app.navLink("Combat").click();
    await expect(page.getByText("No fight right now.")).toBeVisible();
    await expect(app.combat.tracker.turnOrder).toHaveCount(0);
  });

  test("players follow the fight, see their own, and end their own turn", async ({
    combat,
    openAs,
  }) => {
    const tracker = await buildEncounter(combat);
    await tracker.saved();
    const player = (await openAs("playerOne")).combat;
    await player.openAsPlayer();
    await expect(player.page.getByText("No fight right now.")).toBeVisible();

    await tracker.start();
    await expect(player.tracker.whoseTurn).toHaveText("Round 1 · Fixture PC One's turn");
    await expect(player.turnStrip).toHaveCount(4);
    // Their own character, and nothing of the monsters' HP or the DM's notes.
    await expect(player.page.getByRole("listitem", { name: "Fixture PC One" })).toBeVisible();
    expect(await player.page.content()).not.toContain("HP 7/7");

    await player.endMyTurn.click();
    await expect(tracker.turnStatus).toContainText("Fixture Minion 1's turn");
    await expect(player.tracker.whoseTurn).toHaveText("Round 1 · Fixture Minion 1's turn");
    await expect(player.endMyTurn).toHaveCount(0);
  });

  test("players see the turn strip over the map the fight is on", async ({
    api,
    combat,
    openAs,
  }) => {
    const map = await api.createMap({ shared: true });
    const tracker = await buildEncounter(combat);
    await tracker.start();
    await tracker.saved();
    // Set on the map page in Combat mode; here straight through the endpoint.
    const fight = await api.fight();
    const onMap = await api.post("/combat/fight", {
      intent: "save",
      encounter: fight.encounter,
      after: fight.revision,
      map: map.id,
    });
    expect(onMap.status()).toBe(200);

    const player = await openAs("playerOne");
    await player.maps.view(map);
    await expect(player.combat.tracker.whoseTurn).toHaveText("Round 1 · Fixture PC One's turn");
    await expect(player.combat.endMyTurn).toBeVisible();
  });
});
