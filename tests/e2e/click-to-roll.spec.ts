import { expect, test, type Page } from "@playwright/test";
import {
  addMonsters,
  combatant,
  createPrepared,
  face,
  noteBody,
  openCombat,
  openNote,
  scriptDice,
  uniqueName,
} from "./support/app";

/**
 * Clicking rolls in the tracker's statblock panel. "Fixture Minion" has Fixture Jab (+4 to hit,
 * 1d6 + 2 damage), Dex +4 saves, Stealth +6, and Fixture Burst (Recharge 5–6). Dice are scripted.
 */

const d20 = (value: number) => face(20, value);
const d6 = (value: number) => face(6, value);

const statblock = (page: Page) => page.getByRole("region", { name: "Selected statblock" });
const latestRoll = (page: Page) => page.getByRole("status", { name: "Latest roll" });
const rollButton = (page: Page, name: string) =>
  statblock(page).getByRole("button", { name: `Roll ${name}` });

/** One minion in the tracker, with its statblock shown. */
async function showMinion(page: Page) {
  await openCombat(page);
  await scriptDice(page, [d20(10), d6(3), d6(4)]);
  await addMonsters(page, "Fixture Minion", 1);
  await combatant(page, "Fixture Minion 1")
    .getByRole("button", { name: "Show statblock for Fixture Minion 1" })
    .click();
  await expect(statblock(page)).toContainText("Fixture Jab");
}

test.describe("Click to roll", () => {
  test("rolls an attack, labelled with who and what", async ({ page }) => {
    await showMinion(page);
    await scriptDice(page, [d20(13)]);
    await rollButton(page, "Fixture Jab attack: 1d20 + 4").click();

    await expect(latestRoll(page)).toContainText("Fixture Minion 1 · Fixture Jab attack");
    await expect(latestRoll(page)).toContainText("17");
  });

  test("a natural 20 arms Critical, which doubles the next damage dice", async ({ page }) => {
    await showMinion(page);
    const critical = page.getByRole("checkbox", { name: "Critical" });

    await scriptDice(page, [d20(20)]);
    await rollButton(page, "Fixture Jab attack: 1d20 + 4").click();
    await expect(latestRoll(page)).toContainText("Natural 20!");
    await expect(critical).toBeChecked();

    await scriptDice(page, [d6(4), d6(5)]);
    await rollButton(page, "Fixture Jab damage: 1d6 + 2").click();
    await expect(latestRoll(page)).toContainText("Fixture Minion 1 · Fixture Jab damage");
    await expect(latestRoll(page)).toContainText("11");
    await expect(latestRoll(page)).toContainText("2d6 + 2");
    await expect(latestRoll(page)).toContainText("Critical");
    await expect(critical).not.toBeChecked();
  });

  test("rolls saves, skills, ability checks and recharges", async ({ page }) => {
    await showMinion(page);

    await scriptDice(page, [d20(9)]);
    await rollButton(page, "Dex save: 1d20 + 4").click();
    await expect(latestRoll(page)).toContainText("Fixture Minion 1 · Dex save");
    await expect(latestRoll(page)).toContainText("13");

    await scriptDice(page, [d20(9)]);
    await rollButton(page, "Stealth check: 1d20 + 6").click();
    await expect(latestRoll(page)).toContainText("15");

    await scriptDice(page, [d20(9)]);
    await rollButton(page, "DEX check: 1d20 + 2").click();
    await expect(latestRoll(page)).toContainText("11");

    await scriptDice(page, [d6(5)]);
    await rollButton(page, "Fixture Burst recharge").click();
    await expect(latestRoll(page)).toContainText("Recharged");

    await scriptDice(page, [d6(3)]);
    await rollButton(page, "Fixture Burst recharge").click();
    await expect(latestRoll(page)).toContainText("Not recharged");
  });

  test("advantage applies to one d20 roll, then goes back to normal", async ({ page }) => {
    await showMinion(page);
    await page.getByRole("radio", { name: "Advantage", exact: true }).check();

    await scriptDice(page, [d20(6), d20(17)]);
    await rollButton(page, "Fixture Jab attack: 1d20 + 4").click();
    await expect(latestRoll(page)).toContainText("21");
    await expect(latestRoll(page)).toContainText("(advantage)");
    await expect(page.getByRole("radio", { name: "Normal" })).toBeChecked();
  });

  test("keeps wiki statblocks as plain text", async ({ page }) => {
    await openNote(page, "Bestiary/Fixture Minion");
    await expect(noteBody(page)).toContainText("+4 to hit");
    await expect(noteBody(page).getByRole("button")).toHaveCount(0);
  });

  test("leaves rolls inert in the prepared-encounter editor", async ({ page }) => {
    await createPrepared(page, uniqueName("Inert rolls"));
    await addMonsters(page, "Fixture Minion", 1);
    await expect(statblock(page)).toContainText("+4 to hit");
    // There's no dice roller here, so the statblock is inert: not clickable or focusable.
    // (Playwright's role queries still list inert elements, so this checks the attribute.)
    await expect(statblock(page).locator("[inert]")).toContainText("+4 to hit");
  });
});
