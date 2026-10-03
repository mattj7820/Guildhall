import { expect, test } from "./fight-test";
import type { Combat } from "../pages/combat";
import { d20, d6, scriptDice } from "../support/dice";
import { uniqueName } from "../support/test-data";

/**
 * Clicking rolls in the tracker's statblock panel. "Fixture Minion" has Fixture Jab (+4 to hit,
 * 1d6 + 2 damage), Dex +4 saves, Stealth +6, and Fixture Burst (Recharge 5–6). Dice are scripted.
 */

/** One minion in the tracker, with its statblock shown; answers with a roll button's finder. */
async function showMinion(combat: Combat) {
  const { tracker } = combat;
  await combat.open();
  await scriptDice(combat.page, [d20(10), d6(3), d6(4)]);
  await tracker.addMonsters("Fixture Minion", 1);
  await tracker.showStatblock("Fixture Minion 1");
  await expect(tracker.statblock).toContainText("Fixture Jab");
  return (name: string) => tracker.statblock.getByRole("button", { name: `Roll ${name}` });
}

test.describe("Click to roll", () => {
  test("rolls an attack, labelled with who and what", async ({ combat, page }) => {
    const roll = await showMinion(combat);
    await scriptDice(page, [d20(13)]);
    await roll("Fixture Jab attack: 1d20 + 4").click();

    await expect(combat.tracker.latestRoll).toContainText("Fixture Minion 1 · Fixture Jab attack");
    await expect(combat.tracker.latestRoll).toContainText("17");
  });

  test("a natural 20 arms Critical, which doubles the next damage dice", async ({
    combat,
    page,
  }) => {
    const roll = await showMinion(combat);
    const { latestRoll } = combat.tracker;
    const critical = page.getByRole("checkbox", { name: "Critical" });

    await scriptDice(page, [d20(20)]);
    await roll("Fixture Jab attack: 1d20 + 4").click();
    await expect(latestRoll).toContainText("Natural 20!");
    await expect(critical).toBeChecked();

    await scriptDice(page, [d6(4), d6(5)]);
    await roll("Fixture Jab damage: 1d6 + 2").click();
    await expect(latestRoll).toContainText("Fixture Minion 1 · Fixture Jab damage");
    await expect(latestRoll).toContainText("11");
    await expect(latestRoll).toContainText("2d6 + 2");
    await expect(latestRoll).toContainText("Critical");
    await expect(critical).not.toBeChecked();
  });

  test("rolls saves, skills, ability checks and recharges", async ({ combat, page }) => {
    const roll = await showMinion(combat);
    const { latestRoll } = combat.tracker;

    // Each roll is told apart from the last by what it says, since some totals repeat.
    for (const [button, dice, shows] of [
      ["Dex save: 1d20 + 4", [d20(9)], /Dex save.*13/s],
      ["Stealth check: 1d20 + 6", [d20(9)], /Stealth check.*15/s],
      ["DEX check: 1d20 + 2", [d20(9)], /DEX check.*11/s],
      ["Fixture Burst recharge", [d6(5)], /Recharged/],
      ["Fixture Burst recharge", [d6(3)], /Not recharged/],
    ] as const) {
      await scriptDice(page, [...dice]);
      await roll(button).click();
      await expect(latestRoll).toContainText(shows);
    }
  });

  test("advantage applies to one d20 roll, then goes back to normal", async ({ combat, page }) => {
    const roll = await showMinion(combat);
    await page.getByRole("radio", { name: "Advantage", exact: true }).check();

    await scriptDice(page, [d20(6), d20(17)]);
    await roll("Fixture Jab attack: 1d20 + 4").click();
    await expect(combat.tracker.latestRoll).toContainText("21");
    await expect(combat.tracker.latestRoll).toContainText("(advantage)");
    await expect(page.getByRole("radio", { name: "Normal" })).toBeChecked();
  });

  test("keeps wiki statblocks as plain text", async ({ wiki }) => {
    await wiki.openNote("Bestiary/Fixture Minion");
    await expect(wiki.noteBody).toContainText("+4 to hit");
    await expect(wiki.noteBody.getByRole("button")).toHaveCount(0);
  });

  test("leaves rolls inert in the prepared-encounter editor", async ({ prepared }) => {
    await prepared.create(uniqueName("Inert rolls"));
    await prepared.tracker.addMonsters("Fixture Minion", 1);
    const { statblock } = prepared.tracker;
    await expect(statblock).toContainText("+4 to hit");
    // There's no dice roller here, so the statblock is inert: not clickable or focusable.
    // (Playwright's role queries still list inert elements, so this checks the attribute.)
    await expect(statblock.locator("[inert]")).toContainText("+4 to hit");
  });
});
