import { expect, test } from "./support/fixtures";
import { d20, scriptDice } from "./support/dice";
import { SIGNED_IN } from "./support/sign-in";
import { uniqueName } from "./support/test-data";

/**
 * Tracking what gets used up, as Player Two on Fixture PC Two: attacks, features with uses, spell
 * slots, hit dice and rests. Rests give back everything on a sheet, so this is the only spec that
 * changes PC Two's sheet, and it runs in order. Names are unique, and counts are read before and
 * after, so a run repeated against one server still passes.
 */
test.describe.configure({ mode: "serial" });
test.use({ storageState: SIGNED_IN.playerTwo });

test("adds an attack and a feature with uses, ticks them off and rolls, and keeps it all", async ({
  characters,
  page,
}) => {
  const attack = uniqueName("Blade");
  const feature = uniqueName("Focus");
  const sheet = await characters.openSheet("Fixture PC Two");
  await sheet.openTab("Actions");
  await sheet.edit();
  await sheet.setNumber("1st-level slots", 2);
  await sheet.setNumber("d8 hit dice", 3);
  await sheet.addAttack({ name: attack, bonus: 5, damage: "1d8+3" });
  await sheet.addFeature({
    name: feature,
    usedAs: "Bonus action",
    uses: { max: 3, comesBackOn: "Short rest" },
  });
  await sheet.doneEditing();
  await sheet.saved();

  // One click on a lit pip uses one, wherever it's shown.
  await expect(sheet.counter(feature, sheet.trackers)).toHaveAccessibleName(
    `${feature}: 3 of 3 left`,
  );
  await sheet.useOne(feature);
  await expect(sheet.counter(feature).first()).toHaveAccessibleName(`${feature}: 2 of 3 left`);
  const slots = await sheet.left("1st-level slot");
  await sheet.useOne("1st-level slot");
  await expect(sheet.counter("1st-level slot")).toHaveAccessibleName(
    `1st-level slot: ${slots - 1} of 2 left`,
  );
  // A click on a spent pip gives it back.
  await sheet.trackers
    .getByRole("button", { name: "Give back one 1st-level slot" })
    .first()
    .click();
  await expect(sheet.counter("1st-level slot")).toHaveAccessibleName(
    `1st-level slot: ${slots} of 2 left`,
  );

  // The filters narrow the actions to how they're used.
  const actions = page.getByRole("tabpanel");
  await actions.getByRole("button", { name: "Bonus action", exact: true }).click();
  await expect(actions.getByText(feature)).toBeVisible();
  await expect(actions.getByText(attack)).toBeHidden();
  await actions.getByRole("button", { name: "Attack", exact: true }).click();
  await expect(actions.getByText(attack)).toBeVisible();

  await scriptDice(page, [d20(12)]);
  await actions.getByRole("button", { name: `Roll ${attack} attack, +5` }).click();
  await expect(sheet.latestRoll).toContainText(`${attack} attack`);
  await expect(sheet.latestRoll).toContainText("17");
  await sheet.saved();

  await sheet.reload();
  await expect(sheet.counter(feature, sheet.trackers)).toHaveAccessibleName(
    `${feature}: 2 of 3 left`,
  );
  await sheet.openTab("Actions");
  await expect(page.getByRole("tabpanel").getByText(attack)).toBeVisible();
});

test("adds a spell with its wiki note, casts it with a slot and for free, and keeps it all", async ({
  characters,
  page,
}) => {
  const spell = uniqueName("Ward");
  const sheet = await characters.openSheet("Fixture PC Two");
  await sheet.openTab("Spells");
  await sheet.edit();
  await page.getByLabel("Spellcasting ability").selectOption({ label: "Wisdom" });
  const row = await sheet.addSpell({
    name: spell,
    level: "1st",
    note: "Fixture Spark",
    concentration: true,
    attack: true,
    roll: "2d6",
  });
  // A feat's once a day, set up from the spell.
  await row.getByLabel("Free cast").selectOption({ label: "New: once per long rest" });
  await expect(row.getByLabel("Free cast")).toHaveValue(/\w+/);
  await sheet.doneEditing();
  await sheet.saved();

  const spells = page.getByRole("tabpanel");
  // WIS 10 and proficiency +2: DC 10, attack +2.
  await expect(spells).toContainText("Save DC 10");
  await expect(spells.getByRole("button", { name: `Roll ${spell} attack, +2` })).toBeVisible();

  // The linked note, as a player may read it: without its DM parts.
  await spells.getByRole("button", { name: `${spell}: details` }).click();
  await expect(spells).toContainText("Players see this paragraph");
  await expect(page.locator("body")).not.toContainText("sparksecret");

  // For free first, from the other ways to cast it, while a slot is left too.
  const slots = await sheet.left("1st-level slot");
  await spells.getByRole("button", { name: `Other ways to cast ${spell}` }).click();
  await page.getByRole("button", { name: `Free (${spell} (free), 1 left)` }).click();
  await expect(spells.getByRole("status")).toContainText(`Cast ${spell} for free`);
  await expect(sheet.counter(`${spell} (free)`, sheet.trackers)).toHaveAccessibleName(
    `${spell} (free): 0 of 1 left`,
  );
  await expect(sheet.counter("1st-level slot", sheet.trackers)).toHaveAccessibleName(
    `1st-level slot: ${slots} of 2 left`,
  );
  await expect(sheet.trackers).toContainText(`Concentrating: ${spell}`);

  // Then the usual way: the lowest slot left.
  await spells
    .getByRole("button", { name: new RegExp(`^Cast ${spell}: with a 1st-level slot`) })
    .click();
  await expect(sheet.counter("1st-level slot", sheet.trackers)).toHaveAccessibleName(
    `1st-level slot: ${slots - 1} of 2 left`,
  );
  await sheet.saved();

  await sheet.reload();
  await expect(sheet.trackers).toContainText(`Concentrating: ${spell}`);
  await expect(sheet.counter(`${spell} (free)`, sheet.trackers)).toHaveAccessibleName(
    `${spell} (free): 0 of 1 left`,
  );
});
