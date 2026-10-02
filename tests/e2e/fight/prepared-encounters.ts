import { expect, test } from "./fight-test";
import type { Prepared } from "../pages/combat";
import { d20, d6, scriptDice } from "../support/dice";
import { uniqueName } from "../support/test-data";

/**
 * Prepared encounters: set up before a session, kept in the server's data folder, started at the
 * table. "Fixture Minion" has 2d6 hit dice and +2 initiative; the party is "Fixture PC One"
 * (Player One) and "Fixture PC Two" (Player Two). Dice are scripted.
 */

/** Two minions with 7 and 12 HP, and a companion for Player Two. */
async function prepareAmbush(prepared: Prepared, name: string) {
  await prepared.create(name);
  await prepared.page.getByLabel("Encounter notes").fill("Fixture notes");
  await scriptDice(prepared.page, [d6(3), d6(4), d6(6), d6(6)]);
  await prepared.tracker.addMonsters("Fixture Minion", 2);
  await expect(prepared.combatant("Fixture Minion 2")).toBeVisible();
  await prepared.tracker.addCompanion("Player Two", "Fixture Companion");
  await expect(prepared.combatant("Fixture Companion")).toBeVisible();
  await prepared.saved();
}

test.describe("Prepared encounters", () => {
  test("are prepared with monsters and companions, and kept after a reload", async ({
    page,
    prepared,
  }) => {
    const name = uniqueName("Mill ambush");
    await prepareAmbush(prepared, name);

    await prepared.reload();
    await expect(page.getByLabel("Encounter name")).toHaveValue(name);
    await expect(page.getByLabel("Encounter notes")).toHaveValue("Fixture notes");
    await expect(prepared.maxHp("Fixture Minion 1")).toHaveValue("7");
    await expect(prepared.maxHp("Fixture Minion 2")).toHaveValue("12");
    await expect(prepared.combatant("Fixture Companion")).toContainText("Companion · Player Two");
    // No initiative yet: that's rolled when the fight starts.
    await expect(page.getByLabel(/Initiative for/)).toHaveCount(0);

    await prepared.backToList();
    await expect(prepared.card(name)).toContainText(
      "2× Fixture Minion · Fixture Companion (Player Two)",
    );
    await expect(prepared.card(name)).toContainText("Never run");
  });

  test("lets the DM set or reroll a monster's HP", async ({ page, prepared }) => {
    await prepareAmbush(prepared, uniqueName("HP tweaks"));

    await prepared.maxHp("Fixture Minion 1").fill("20");
    await prepared.maxHp("Fixture Minion 1").press("Enter");
    await prepared.saved();
    await prepared.reload();
    await expect(prepared.maxHp("Fixture Minion 1")).toHaveValue("20");

    await scriptDice(page, [d6(1), d6(1)]);
    await prepared
      .combatant("Fixture Minion 1")
      .getByRole("button", { name: "Reroll HP for Fixture Minion 1" })
      .click();
    await expect(prepared.maxHp("Fixture Minion 1")).toHaveValue("2");
    await prepared.saved();
  });

  test("can be duplicated and deleted", async ({ prepared }) => {
    const name = uniqueName("Bridge toll");
    await prepareAmbush(prepared, name);
    await prepared.backToList();

    await prepared
      .card(name)
      .getByRole("button", { name: `Duplicate ${name}` })
      .click();
    const copy = prepared.card(`${name} (copy)`);
    await expect(copy).toContainText("2× Fixture Minion");

    await copy.getByRole("button", { name: `Delete ${name} (copy)…` }).click();
    await copy.getByRole("button", { name: `Delete ${name} (copy)`, exact: true }).click();
    await expect(copy).toHaveCount(0);
    await expect(prepared.card(name)).toBeVisible();
  });

  test("can be deleted from the editor, after a confirmation", async ({ page, prepared }) => {
    const name = uniqueName("Short lived");
    await prepared.create(name);
    await page.getByRole("button", { name: "Delete…" }).click();
    await page.getByRole("button", { name: "Delete encounter" }).click();

    await expect(page).toHaveURL(/\/combat\/prepared$/);
    await expect(page.getByRole("listitem", { name, exact: true })).toHaveCount(0);
  });

  test("start at the table: pick the party, and monsters roll initiative", async ({
    combat,
    page,
    prepared,
  }) => {
    const name = uniqueName("Ready to run");
    await prepareAmbush(prepared, name);
    const panel = await prepared.startFromEditor(name);

    await expect(panel).toContainText("2× Fixture Minion");
    await panel.getByRole("checkbox", { name: /Fixture PC Two/ }).uncheck();
    await scriptDice(page, [d20(10), d20(5)]);
    await panel.getByRole("button", { name: "Add to tracker" }).click();

    await expect(page).toHaveURL(/\/combat$/);
    await expect(panel).toHaveCount(0);
    const { tracker } = combat;
    await expect(tracker.combatant("Fixture Minion 1").getByLabel(/Initiative/)).toHaveValue("12");
    await expect(tracker.combatant("Fixture Minion 2").getByLabel(/Initiative/)).toHaveValue("7");
    await expect(tracker.combatant("Fixture Minion 2")).toContainText("HP 12/12");
    await expect(tracker.combatant("Fixture Companion")).toContainText("Player Two");
    await expect(tracker.combatant("Fixture PC One").getByLabel(/Initiative/)).toHaveValue("");
    await expect(tracker.combatant("Fixture PC Two")).toHaveCount(0);
    await expect(
      page.getByText("Waiting for initiative: Fixture Companion, Fixture PC One"),
    ).toBeVisible();

    // The prepared encounter is a template: recorded as run, but otherwise unchanged.
    await page.getByRole("link", { name: "Prepared encounters" }).click();
    await expect(prepared.card(name)).toContainText("Last run");
    await prepared
      .card(name)
      .getByRole("link", { name: `Edit ${name}` })
      .click();
    await expect(prepared.combatant("Fixture Minion 1")).toBeVisible();
    await expect(page.getByLabel(/Initiative for/)).toHaveCount(0);
    await expect(prepared.combatant("Fixture PC One")).toHaveCount(0);
  });

  test("starting replaces the fight in the tracker, and undo brings it back", async ({
    combat,
    page,
    prepared,
  }) => {
    const { tracker } = combat;
    await combat.open();
    await tracker.addPartyMember("Fixture PC One");
    await tracker.saved();

    const name = uniqueName("Interruption");
    await prepareAmbush(prepared, name);
    const panel = await prepared.startFromEditor(name);
    await expect(panel).toContainText("This replaces the fight in the tracker");
    await scriptDice(page, [d20(10), d20(5)]);
    await panel.getByRole("button", { name: "Add to tracker" }).click();
    await expect(tracker.combatant("Fixture Minion 1")).toBeVisible();

    await tracker.undo();
    await expect(tracker.combatant("Fixture Minion 1")).toHaveCount(0);
    await expect(tracker.combatant("Fixture PC One")).toBeVisible();
  });

  test("a fight set up in the tracker can be saved as prepared", async ({
    combat,
    page,
    prepared,
  }) => {
    const { tracker } = combat;
    await combat.open();
    await tracker.addMonsters("Fixture Minion", 1);
    await expect(tracker.combatant("Fixture Minion 1")).toBeVisible();
    await tracker.addPartyMember("Fixture PC One");

    const name = uniqueName("Saved from the table");
    await tracker.saveAsPrepared(name);

    await page.getByRole("link", { name: "Edit it" }).click();
    await expect(page.getByLabel("Encounter name")).toHaveValue(name);
    await expect(prepared.combatant("Fixture Minion 1")).toBeVisible();
    // The party is chosen when it starts, so it isn't kept.
    await expect(prepared.combatant("Fixture PC One")).toHaveCount(0);
  });

  test("says so when a prepared encounter to start no longer exists", async ({ combat, page }) => {
    await combat.goto("/combat?start=no-such-encounter");
    await expect(page.getByRole("alert")).toContainText("doesn't exist any more");
    await expect(combat.tracker.turnOrder).toHaveCount(0);
  });

  test("are DM-only", async ({ page, prepared }) => {
    await prepared.open();
    await prepared.previewAsPlayer();
    await expect(page.getByText("Prepared encounters are the DM's.")).toBeVisible();
    await expect(prepared.list).toHaveCount(0);
  });
});
