import { expect, test, type Page } from "@playwright/test";
import {
  addMonsters,
  combatant,
  face,
  openCombat,
  scriptDice,
  setInitiative,
  switchToPlayerView,
  turnOrder,
  turnStatus,
} from "./support/app";

/**
 * The combat tracker over the fixture vault. "Fixture Minion" has DEX 14 (+2 initiative) and 2d6
 * hit dice; the party is "Fixture PC One" (Player One) and "Fixture PC Two" (Player Two). Dice
 * are scripted, so every roll is known.
 */

const d20 = (value: number) => face(20, value);
const d6 = (value: number) => face(6, value);

const orderOfPlay = (page: Page) =>
  turnOrder(page)
    .getByRole("listitem")
    .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

/** Two minions (initiative 12 and 7; 7 and 12 HP) and the party, with no ties. */
async function buildEncounter(page: Page) {
  await openCombat(page);
  // Per monster: initiative d20, then 2d6 hit points.
  await scriptDice(page, [d20(10), d6(3), d6(4), d20(5), d6(6), d6(6)]);
  await addMonsters(page, "Fixture Minion", 2);
  await page.getByRole("button", { name: "Add Fixture PC One" }).click();
  await page.getByRole("button", { name: "Add Fixture PC Two" }).click();
  await setInitiative(page, "Fixture PC One", 18);
  await setInitiative(page, "Fixture PC Two", 9);
}

test.describe("Combat tracker", () => {
  test("builds an encounter from a vault statblock and orders it by initiative", async ({
    page,
  }) => {
    await buildEncounter(page);

    expect(await orderOfPlay(page)).toEqual([
      "Fixture PC One",
      "Fixture Minion 1",
      "Fixture PC Two",
      "Fixture Minion 2",
    ]);
    await expect(combatant(page, "Fixture Minion 1").getByLabel(/Initiative/)).toHaveValue("12");
    await expect(combatant(page, "Fixture Minion 1")).toContainText("HP 7/7");
    await expect(combatant(page, "Fixture Minion 1")).toContainText("AC 13");
    await expect(combatant(page, "Fixture Minion 2")).toContainText("HP 12/12");
    await expect(combatant(page, "Fixture PC One")).toContainText("Player One");
  });

  test("breaks an initiative tie between a monster and a player with rerolls", async ({ page }) => {
    await buildEncounter(page);
    const start = page.getByRole("button", { name: "Start combat" });
    const ties = page.getByRole("region", { name: "Ties to break" });

    // PC Two ties Minion 1 on 12: the minion rerolls by itself, the player is asked for theirs.
    await scriptDice(page, [d20(11)]);
    await setInitiative(page, "Fixture PC Two", 12);
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
    expect(await orderOfPlay(page)).toEqual([
      "Fixture PC One",
      "Fixture PC Two",
      "Fixture Minion 1",
      "Fixture Minion 2",
    ]);
  });

  test("runs turns and rounds, tracks monster HP and survives a reload", async ({ page }) => {
    await buildEncounter(page);
    await page.getByRole("button", { name: "Start combat" }).click();
    await expect(turnStatus(page)).toContainText("Round 1 · Fixture PC One's turn");

    await page.getByRole("button", { name: "Next turn" }).click();
    await expect(turnStatus(page)).toContainText("Fixture Minion 1's turn");
    // The statblock follows the monster whose turn it is.
    await expect(
      page.getByRole("region", { name: "Statblock: Fixture Minion", exact: true }),
    ).toBeVisible();

    const minion = combatant(page, "Fixture Minion 1");
    await minion.getByLabel("Amount for Fixture Minion 1").fill("4");
    await minion.getByRole("button", { name: "Damage Fixture Minion 1" }).click();
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

    // Minion 1 is down, so after Minion 2 and a new round, play skips it.
    const next = page.getByRole("button", { name: "Next turn" });
    await next.click();
    await next.click();
    await expect(turnStatus(page)).toContainText("Fixture Minion 2's turn");
    await next.click();
    await expect(turnStatus(page)).toContainText("Round 2 · Fixture PC One's turn");
    await next.click();
    await next.click();
    await expect(turnStatus(page)).toContainText("Round 2 · Fixture Minion 2's turn");

    await page.reload();
    await expect(turnStatus(page)).toContainText("Round 2 · Fixture Minion 2's turn");
    await expect(combatant(page, "Fixture Minion 1")).toContainText("HP 0/7");
    await expect(combatant(page, "Fixture Minion 1")).toContainText("prone");
  });

  test("undoes the last change", async ({ page }) => {
    await buildEncounter(page);
    const minion = combatant(page, "Fixture Minion 2");
    await minion.getByLabel("Amount for Fixture Minion 2").fill("5");
    await minion.getByRole("button", { name: "Damage Fixture Minion 2" }).click();
    await expect(minion).toContainText("HP 7/12");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(minion).toContainText("HP 12/12");
  });

  test("starts a new encounter, which undo can bring back", async ({ page }) => {
    await buildEncounter(page);
    await page.getByRole("button", { name: "New encounter" }).click();
    await expect(turnOrder(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(combatant(page, "Fixture PC One")).toBeVisible();
  });

  test("adds a companion controlled by a player, linked to its statblock", async ({ page }) => {
    await openCombat(page);
    const form = page.getByRole("form", { name: "Add a companion or other player combatant" });
    await form.getByLabel("Controlled by").fill("Player Two");
    await form
      .getByLabel("Linked statblock (optional)")
      .selectOption({ label: "Fixture Companion" });
    await form.getByRole("button", { name: "Add player combatant" }).click();

    const companion = combatant(page, "Fixture Companion");
    await expect(companion).toContainText("Companion · Player Two");
    await companion.getByRole("button", { name: "Show statblock for Fixture Companion" }).click();
    await expect(
      page.getByRole("region", { name: "Statblock: Fixture Companion", exact: true }),
    ).toBeVisible();
  });

  test("rolls dice expressions with advantage", async ({ page }) => {
    await openCombat(page);
    await page.getByLabel("Dice to roll").fill("1d20+2");
    await page.getByLabel("Advantage", { exact: true }).check();
    await scriptDice(page, [d20(6), d20(17)]);
    await page.getByRole("button", { name: "Roll", exact: true }).click();

    await expect(page.getByRole("status", { name: "Latest roll" })).toContainText("19");
  });

  test("explains a dice expression it can't read", async ({ page }) => {
    await openCombat(page);
    await page.getByLabel("Dice to roll").fill("fireball");
    await page.getByRole("button", { name: "Roll", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Couldn't read");
  });

  test("is DM-only: the player preview gets a notice and no hub card or nav link", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Combat tracker/ })).toBeVisible();
    await switchToPlayerView(page);
    await expect(page.getByRole("link", { name: /Combat tracker/ })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Combat" }),
    ).toHaveCount(0);

    await page.goto("/combat");
    await expect(page.getByText("The combat tracker is DM-only for now.")).toBeVisible();
    await expect(turnOrder(page)).toHaveCount(0);
  });
});
