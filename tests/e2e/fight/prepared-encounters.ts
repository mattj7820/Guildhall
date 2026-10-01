import { expect, test, type Page } from "@playwright/test";
import {
  addCompanion,
  addMonsters,
  combatant,
  createPrepared,
  expectSaved,
  face,
  openCombat,
  preparedCombatant,
  preparedList,
  scriptDice,
  switchToPlayerView,
  turnOrder,
  uniqueName,
} from "../support/app";

/**
 * Prepared encounters: set up before a session, kept in the server's data folder, started at the
 * table. "Fixture Minion" has 2d6 hit dice and +2 initiative; the party is "Fixture PC One"
 * (Player One) and "Fixture PC Two" (Player Two). Dice are scripted.
 */

const d6 = (value: number) => face(6, value);
const d20 = (value: number) => face(20, value);

/** Two minions with 7 and 12 HP, and a companion for Player Two. */
async function prepareAmbush(page: Page, name: string) {
  await createPrepared(page, name);
  await page.getByLabel("Encounter notes").fill("Fixture notes");
  await scriptDice(page, [d6(3), d6(4), d6(6), d6(6)]);
  await addMonsters(page, "Fixture Minion", 2);
  await addCompanion(page, "Player Two", "Fixture Companion");
  await expectSaved(page);
}

const card = (page: Page, name: string) =>
  preparedList(page).getByRole("listitem", { name, exact: true });

const maxHp = (page: Page, name: string) =>
  preparedCombatant(page, name).getByLabel(`Max HP for ${name}`);

test.describe("Prepared encounters", () => {
  test("are prepared with monsters and companions, and kept after a reload", async ({ page }) => {
    const name = uniqueName("Mill ambush");
    await prepareAmbush(page, name);

    await page.reload();
    await expect(page.getByLabel("Encounter name")).toHaveValue(name);
    await expect(page.getByLabel("Encounter notes")).toHaveValue("Fixture notes");
    await expect(maxHp(page, "Fixture Minion 1")).toHaveValue("7");
    await expect(maxHp(page, "Fixture Minion 2")).toHaveValue("12");
    await expect(preparedCombatant(page, "Fixture Companion")).toContainText(
      "Companion · Player Two",
    );
    // No initiative yet: that's rolled when the fight starts.
    await expect(page.getByLabel(/Initiative for/)).toHaveCount(0);

    await page.getByRole("link", { name: "← All prepared encounters" }).click();
    await expect(card(page, name)).toContainText(
      "2× Fixture Minion · Fixture Companion (Player Two)",
    );
    await expect(card(page, name)).toContainText("Never run");
  });

  test("lets the DM set or reroll a monster's HP", async ({ page }) => {
    await prepareAmbush(page, uniqueName("HP tweaks"));

    await maxHp(page, "Fixture Minion 1").fill("20");
    await maxHp(page, "Fixture Minion 1").press("Enter");
    await expectSaved(page);
    await page.reload();
    await expect(maxHp(page, "Fixture Minion 1")).toHaveValue("20");

    await scriptDice(page, [d6(1), d6(1)]);
    await preparedCombatant(page, "Fixture Minion 1")
      .getByRole("button", { name: "Reroll HP for Fixture Minion 1" })
      .click();
    await expect(maxHp(page, "Fixture Minion 1")).toHaveValue("2");
    await expectSaved(page);
  });

  test("can be duplicated and deleted", async ({ page }) => {
    const name = uniqueName("Bridge toll");
    await prepareAmbush(page, name);
    await page.getByRole("link", { name: "← All prepared encounters" }).click();

    await card(page, name)
      .getByRole("button", { name: `Duplicate ${name}` })
      .click();
    const copy = card(page, `${name} (copy)`);
    await expect(copy).toContainText("2× Fixture Minion");

    await copy.getByRole("button", { name: `Delete ${name} (copy)…` }).click();
    await copy.getByRole("button", { name: `Delete ${name} (copy)`, exact: true }).click();
    await expect(copy).toHaveCount(0);
    await expect(card(page, name)).toBeVisible();
  });

  test("can be deleted from the editor, after a confirmation", async ({ page }) => {
    const name = uniqueName("Short lived");
    await createPrepared(page, name);
    await page.getByRole("button", { name: "Delete…" }).click();
    await page.getByRole("button", { name: "Delete encounter" }).click();

    await expect(page).toHaveURL(/\/combat\/prepared$/);
    await expect(page.getByRole("listitem", { name, exact: true })).toHaveCount(0);
  });

  test("start at the table: pick the party, and monsters roll initiative", async ({ page }) => {
    const name = uniqueName("Ready to run");
    await prepareAmbush(page, name);
    await page.getByRole("link", { name: "Start", exact: true }).click();

    const panel = page.getByRole("region", { name: `Start “${name}”` });
    await expect(panel).toContainText("2× Fixture Minion");
    await panel.getByRole("checkbox", { name: /Fixture PC Two/ }).uncheck();
    await scriptDice(page, [d20(10), d20(5)]);
    await panel.getByRole("button", { name: "Add to tracker" }).click();

    await expect(page).toHaveURL(/\/combat$/);
    await expect(panel).toHaveCount(0);
    await expect(combatant(page, "Fixture Minion 1").getByLabel(/Initiative/)).toHaveValue("12");
    await expect(combatant(page, "Fixture Minion 2").getByLabel(/Initiative/)).toHaveValue("7");
    await expect(combatant(page, "Fixture Minion 2")).toContainText("HP 12/12");
    await expect(combatant(page, "Fixture Companion")).toContainText("Player Two");
    await expect(combatant(page, "Fixture PC One").getByLabel(/Initiative/)).toHaveValue("");
    await expect(combatant(page, "Fixture PC Two")).toHaveCount(0);
    await expect(
      page.getByText("Waiting for initiative: Fixture Companion, Fixture PC One"),
    ).toBeVisible();

    // The prepared encounter is a template: recorded as run, but otherwise unchanged.
    await page.getByRole("link", { name: "Prepared encounters" }).click();
    await expect(card(page, name)).toContainText("Last run");
    await card(page, name)
      .getByRole("link", { name: `Edit ${name}` })
      .click();
    await expect(preparedCombatant(page, "Fixture Minion 1")).toBeVisible();
    await expect(page.getByLabel(/Initiative for/)).toHaveCount(0);
    await expect(preparedCombatant(page, "Fixture PC One")).toHaveCount(0);
  });

  test("starting replaces the fight in the tracker, and undo brings it back", async ({ page }) => {
    await openCombat(page);
    await page.getByRole("button", { name: "Add Fixture PC One" }).click();

    const name = uniqueName("Interruption");
    await prepareAmbush(page, name);
    await page.getByRole("link", { name: "Start", exact: true }).click();
    const panel = page.getByRole("region", { name: `Start “${name}”` });
    await expect(panel).toContainText("This replaces the fight in the tracker");
    await scriptDice(page, [d20(10), d20(5)]);
    await panel.getByRole("button", { name: "Add to tracker" }).click();
    await expect(combatant(page, "Fixture Minion 1")).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(combatant(page, "Fixture Minion 1")).toHaveCount(0);
    await expect(combatant(page, "Fixture PC One")).toBeVisible();
  });

  test("a fight set up in the tracker can be saved as prepared", async ({ page }) => {
    await openCombat(page);
    await addMonsters(page, "Fixture Minion", 1);
    await page.getByRole("button", { name: "Add Fixture PC One" }).click();

    const name = uniqueName("Saved from the table");
    await page.getByText("Save as a prepared encounter").click();
    await page.getByLabel("Prepared encounter name").fill(name);
    await page.getByRole("button", { name: "Save as prepared" }).click();
    await expect(page.getByText(`Saved as “${name}”.`)).toBeVisible();

    await page.getByRole("link", { name: "Edit it" }).click();
    await expect(page.getByLabel("Encounter name")).toHaveValue(name);
    await expect(preparedCombatant(page, "Fixture Minion 1")).toBeVisible();
    // The party is chosen when it starts, so it isn't kept.
    await expect(preparedCombatant(page, "Fixture PC One")).toHaveCount(0);
  });

  test("says so when a prepared encounter to start no longer exists", async ({ page }) => {
    await page.goto("/combat?start=no-such-encounter");
    await expect(page.getByRole("alert")).toContainText("doesn't exist any more");
    await expect(turnOrder(page)).toHaveCount(0);
  });

  test("are DM-only", async ({ page }) => {
    await page.goto("/combat/prepared");
    await switchToPlayerView(page);
    await expect(page.getByText("Prepared encounters are the DM's.")).toBeVisible();
    await expect(preparedList(page)).toHaveCount(0);
  });
});
