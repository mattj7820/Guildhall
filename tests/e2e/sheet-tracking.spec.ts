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
