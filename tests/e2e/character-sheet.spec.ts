import { expect, test } from "./support/fixtures";
import { d20, scriptDice } from "./support/dice";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Editing a sheet and rolling from it, as Player One on Fixture PC One. The only spec that
 * changes this sheet's fields, and serial, so the tests can build on each other; other specs only
 * add their own uniquely named items to its bag.
 */
test.describe.configure({ mode: "serial" });
test.use({ storageState: SIGNED_IN.playerOne });

test("edits the sheet, rolls a skill check from it, and keeps it all after a reload", async ({
  characters,
  page,
}) => {
  const sheet = await characters.openSheet("Fixture PC One");
  await sheet.edit();
  await sheet.setNumber("Dexterity score", 16);
  await sheet.setNumber("Proficiency bonus", 2);
  const stealth = page.getByRole("button", { name: /^Stealth: / });
  // Cycle the proficiency mark round to "proficient", one step at a time.
  for (let clicks = 0; clicks < 4; clicks++) {
    const label = (await stealth.getAttribute("aria-label")) ?? "";
    if (/^Stealth: proficient\./.test(label)) break;
    await stealth.click();
    await expect(stealth).not.toHaveAttribute("aria-label", label);
  }
  await expect(stealth).toHaveAttribute("aria-label", /^Stealth: proficient\./);
  await sheet.setNumber("Max", 20);
  await sheet.setNumber("Current", 20);
  await sheet.doneEditing();
  await sheet.saved();

  // DEX 16 (+3) and proficient (+2): a d20 of 12 makes 17.
  await scriptDice(page, [d20(12)]);
  await page.getByRole("button", { name: "Roll Stealth, +5" }).click();
  await expect(sheet.latestRoll).toContainText("Fixture PC One · Stealth");
  await expect(sheet.latestRoll).toContainText("17");

  await sheet.changeHitPoints("Damage", 7);
  await sheet.saved();

  await sheet.reload();
  await expect(page.getByRole("button", { name: "Roll Stealth, +5" })).toBeVisible();
  await expect(sheet.hitPoints).toContainText("13");
});

test("undoes a change", async ({ characters }) => {
  const sheet = await characters.openSheet("Fixture PC One");
  await sheet.edit();
  await sheet.setNumber("Strength score", 18);
  await sheet.saved();
  await sheet.undo();
  await sheet.saved();
  await sheet.reload();
  await sheet.edit();
  await expect(sheet.field("Strength score")).toHaveValue("10");
});

test("the DM and the player change the same sheet at once without losing either", async ({
  characters,
  openAs,
}) => {
  const dm = await (await openAs("dm")).characters.openSheet("Fixture PC One");
  const sheet = await characters.openSheet("Fixture PC One");
  const armour = 11 + Math.floor(Math.random() * 19);

  // Different things: both are kept.
  await sheet.edit();
  await sheet.setNumber("Armour class", armour);
  await sheet.saved();
  await dm.changeHitPoints("Heal", 1);
  await dm.saved();
  await expect(dm.notices).toContainText("Updated with changes made elsewhere.");

  // The same thing, changed by the player while the DM's page still shows the old value: the
  // later change wins, and its sender is told what it replaced.
  await dm.edit();
  await sheet.setNumber("Armour class", armour + 1);
  await sheet.saved();
  await dm.setNumber("Armour class", armour + 20);
  await expect(dm.notices).toContainText(
    `Armour class had been changed to ${armour + 1} elsewhere; yours (${armour + 20}) was kept.`,
  );
  await dm.saved();

  await sheet.reload();
  await sheet.edit();
  await expect(sheet.field("Armour class")).toHaveValue(String(armour + 20));
  await expect(sheet.field("Current")).toHaveValue("14");
});

test("can't change someone else's sheet, or pick an image kept from them", async ({
  api,
  characters,
  openAs,
}) => {
  const otherSheet = (await (await openAs("dm")).characters.openSheet("Fixture PC Two")).path;

  const heal = { baseRevision: 0, actions: [{ type: "heal", amount: 1 }] };
  expect((await api.post(`${otherSheet}/changes`, heal)).status()).toBe(404);
  expect((await api.request.get(`${otherSheet}/changes`)).status()).toBe(404);

  const own = (await characters.openSheet("Fixture PC One")).path;
  const hiddenPortrait = await api.post(`${own}/changes`, {
    baseRevision: 0,
    actions: [{ type: "portrait", value: "Attachments/dm-map.png" }],
  });
  expect(hiddenPortrait.status()).toBe(400);
});
