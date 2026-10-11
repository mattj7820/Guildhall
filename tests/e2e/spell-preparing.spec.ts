import { expect, test } from "./support/fixtures";
import { REVEAL_ALL, uniqueName } from "./support/test-data";

/**
 * Preparing spells, as Player One on Fixture PC One: the number to prepare, Prepare mode, what's
 * ready day to day on the sheet and beside the map, and undo. Only this spec adds spells to PC One,
 * and it never rests. Counts are read first and compared after, so a run repeated against one
 * server still passes.
 */

test("a player prepares spells, sees only what's ready, and keeps it after a reload", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL] });
  const player = await openAs("playerOne");
  const [ward, gift, spark] = ["Ward", "Gift", "Spark"].map(uniqueName);
  const cantrip = uniqueName("Glow");

  const sheet = await player.characters.openSheet("Fixture PC One");
  await sheet.openTab("Spells");
  await sheet.edit();
  await sheet.addSpell({ name: cantrip, level: "Cantrip" });
  for (const name of [ward, gift, spark]) await sheet.addSpell({ name, level: "1st" });
  await sheet.doneEditing();

  // None of the new spells prepared, whatever an earlier run left: then one more to prepare.
  await sheet.openPrepare();
  for (const name of [ward, gift, spark]) await sheet.prepareBox(name).uncheck();
  // A cantrip is always ready, so there's nothing to tick.
  await expect(sheet.prepareBox(cantrip)).toHaveCount(0);
  await expect(sheet.spells.getByRole("region", { name: "Cantrips" })).toContainText(cantrip);
  const before = await sheet.prepared();
  await sheet.spells.getByRole("button", { name: "Done", exact: true }).click();
  await sheet.edit();
  await sheet.setNumber("Spells to prepare", before + 1);
  await sheet.doneEditing();
  await expect(sheet.spells).toContainText(`Prepares ${before + 1}`);

  // Preparing one fills the number; a second goes over, which warns but never stops anyone.
  await sheet.openPrepare();
  await sheet.prepareBox(ward).check();
  await expect(sheet.preparedCount()).toHaveText(`${before + 1} / ${before + 1} prepared`);
  await sheet.prepareBox(gift).check();
  await expect(sheet.preparedCount()).toHaveText(
    `${before + 2} / ${before + 1} prepared · 1 more than you prepare`,
  );
  await sheet.spells.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet.spells.getByRole("alert")).toContainText(
    `${before + 2} prepared, 1 more than the ${before + 1} you prepare`,
  );
  await sheet.spells.getByRole("button", { name: "Keep choosing" }).click();
  await sheet.prepareBox(gift).uncheck();

  // A change is undone like any other.
  await sheet.prepareBox(spark).check();
  await sheet.undo();
  await expect(sheet.prepareBox(spark)).not.toBeChecked();
  await sheet.spells.getByRole("button", { name: "Done", exact: true }).click();

  // Day to day, only what's ready: the prepared spell and the cantrip.
  await expect(sheet.readySpell(ward)).toBeVisible();
  await expect(sheet.readySpell(cantrip)).toBeVisible();
  await expect(sheet.readySpell(gift)).toHaveCount(0);
  await expect(sheet.readySpell(spark)).toHaveCount(0);
  await expect(sheet.spells).toContainText(/\d+ spells? not prepared/);
  await sheet.saved();

  await sheet.reload();
  await sheet.openTab("Spells");
  await expect(sheet.readySpell(ward)).toBeVisible();
  await expect(sheet.readySpell(gift)).toHaveCount(0);

  // Beside the map too.
  const view = await player.maps.view(map);
  const panel = view.page.getByRole("complementary", { name: "Side panel" });
  await panel.getByRole("tab", { name: "Sheet" }).click();
  await panel.getByRole("tab", { name: "Spells" }).click();
  await expect(sheet.readySpell(ward, panel)).toBeVisible();
  await expect(sheet.readySpell(cantrip, panel)).toBeVisible();
  await expect(sheet.readySpell(spark, panel)).toHaveCount(0);
  await sheet.openPrepare(panel);
  await expect(sheet.prepareBox(ward, panel)).toBeChecked();
  await expect(sheet.prepareBox(spark, panel)).not.toBeChecked();
});
