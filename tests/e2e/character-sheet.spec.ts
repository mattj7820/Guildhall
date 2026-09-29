import { expect, test, type Page } from "@playwright/test";
import { face, openCharacter, ORIGIN, scriptDice } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Editing a sheet and rolling from it, as Player One on Fixture PC One. The only spec that
 * changes this sheet's fields, and serial, so the tests can build on each other; other specs only
 * add their own uniquely named items to its bag.
 */
test.describe.configure({ mode: "serial" });
test.use({ storageState: SIGNED_IN.playerOne });

const saved = (page: Page) => expect(page.getByText("✓ All changes saved")).toBeVisible();

async function setNumber(page: Page, label: string, value: number) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(String(value));
  await field.press("Enter");
}

test("edits the sheet, rolls a skill check from it, and keeps it all after a reload", async ({
  page,
}) => {
  await openCharacter(page, "Fixture PC One");
  await page.getByRole("button", { name: "Edit sheet" }).click();
  await setNumber(page, "Dexterity score", 16);
  await setNumber(page, "Proficiency bonus", 2);
  const stealth = page.getByRole("button", { name: /^Stealth: / });
  // Cycle the proficiency mark round to "proficient".
  while (!/^Stealth: proficient\./.test((await stealth.getAttribute("aria-label")) ?? "")) {
    await stealth.click();
  }
  await setNumber(page, "Max", 20);
  await setNumber(page, "Current", 20);
  await page.getByRole("button", { name: "Done editing" }).click();
  await saved(page);

  // DEX 16 (+3) and proficient (+2): a d20 of 12 makes 17.
  await scriptDice(page, [face(20, 12)]);
  await page.getByRole("button", { name: "Roll Stealth, +5" }).click();
  const latest = page.getByRole("status", { name: "Latest roll" });
  await expect(latest).toContainText("Fixture PC One · Stealth");
  await expect(latest).toContainText("17");

  await page.getByLabel("Amount of healing or damage").fill("7");
  await page.getByRole("button", { name: "Damage" }).click();
  await saved(page);

  await page.reload();
  await expect(page.getByRole("button", { name: "Roll Stealth, +5" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hit points" })).toContainText("13");
});

test("undoes a change", async ({ page }) => {
  await openCharacter(page, "Fixture PC One");
  await page.getByRole("button", { name: "Edit sheet" }).click();
  await setNumber(page, "Strength score", 18);
  await saved(page);
  await page.getByRole("button", { name: "Undo" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "Edit sheet" }).click();
  await expect(page.getByLabel("Strength score", { exact: true })).toHaveValue("10");
});

test("the DM and the player change the same sheet at once without losing either", async ({
  page,
  browser,
}) => {
  const dm = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
  const dmPage = await dm.newPage();
  await openCharacter(dmPage, "Fixture PC One");
  await openCharacter(page, "Fixture PC One");
  const armour = 11 + Math.floor(Math.random() * 19);

  // Different things: both are kept.
  await page.getByRole("button", { name: "Edit sheet" }).click();
  await setNumber(page, "Armour class", armour);
  await saved(page);
  await dmPage.getByLabel("Amount of healing or damage").fill("1");
  await dmPage.getByRole("button", { name: "Heal" }).click();
  await expect(dmPage.getByText("✓ All changes saved")).toBeVisible();
  await expect(dmPage.getByRole("list", { name: "Notices" })).toContainText(
    "Updated with changes made elsewhere.",
  );

  // The same thing, changed by the player while the DM's page still shows the old value: the
  // later change wins, and its sender is told what it replaced.
  await dmPage.getByRole("button", { name: "Edit sheet" }).click();
  await setNumber(page, "Armour class", armour + 1);
  await saved(page);
  await setNumber(dmPage, "Armour class", armour + 20);
  await expect(dmPage.getByRole("list", { name: "Notices" })).toContainText(
    `Armour class had been changed to ${armour + 1} elsewhere; yours (${armour + 20}) was kept.`,
  );
  await dm.close();

  await page.reload();
  await page.getByRole("button", { name: "Edit sheet" }).click();
  await expect(page.getByLabel("Armour class", { exact: true })).toHaveValue(String(armour + 20));
  await expect(page.getByLabel("Current", { exact: true })).toHaveValue("14");
});

test("can't change someone else's sheet, or pick an image kept from them", async ({
  page,
  browser,
}) => {
  const dm = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
  const dmPage = await dm.newPage();
  await openCharacter(dmPage, "Fixture PC Two");
  const otherSheet = new URL(dmPage.url()).pathname;
  await dm.close();

  const heal = { baseRevision: 0, actions: [{ type: "heal", amount: 1 }] };
  const theirs = await page.request.post(`${otherSheet}/changes`, {
    headers: { Origin: ORIGIN },
    data: heal,
  });
  expect(theirs.status()).toBe(404);
  expect((await page.request.get(`${otherSheet}/changes`)).status()).toBe(404);

  await openCharacter(page, "Fixture PC One");
  const own = new URL(page.url()).pathname;
  const hiddenPortrait = await page.request.post(`${own}/changes`, {
    headers: { Origin: ORIGIN },
    data: { baseRevision: 0, actions: [{ type: "portrait", value: "Attachments/dm-map.png" }] },
  });
  expect(hiddenPortrait.status()).toBe(400);
});
