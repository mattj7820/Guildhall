import { expect, test } from "./support/fixtures";
import { d20, scriptDice } from "./support/dice";
import { REVEAL_ALL, SQUARES_64, uniqueName } from "./support/test-data";

/**
 * A player's sheet and bag beside the map. Tests start as the DM, who makes and shares a battle
 * map; Player One gets a second browser. Player One's sheet only gains uniquely named things here,
 * and is never rested, so this runs beside the sheet specs.
 */

const px = (x: number, y: number): [number, number] => [x / 1024, y / 512];

test("a player opens their sheet beside the map, ticks a use and rolls, while the map stays usable", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL], grid: SQUARES_64 });
  const player = await openAs("playerOne");
  const attack = uniqueName("Staff");
  const feature = uniqueName("Ki");

  const sheet = await player.characters.openSheet("Fixture PC One");
  await sheet.openTab("Actions");
  await sheet.edit();
  await sheet.addAttack({ name: attack, bonus: 4, damage: "1d6+2" });
  await sheet.addFeature({
    name: feature,
    usedAs: "Bonus action",
    uses: { max: 2, comesBackOn: "Short rest" },
  });
  await sheet.doneEditing();
  await sheet.saved();

  const view = await player.maps.view(map);
  const page = view.page;
  const panel = page.getByRole("complementary", { name: "Side panel" });
  await panel.getByRole("tab", { name: "Sheet" }).click();
  await expect(panel.getByRole("heading", { name: "Fixture PC One" })).toBeVisible();

  // Tick a use, and roll an attack, from beside the map.
  await panel
    .getByRole("button", { name: `Use one ${feature}` })
    .first()
    .click();
  await expect(sheet.counter(feature, panel)).toHaveAccessibleName(`${feature}: 1 of 2 left`);
  await scriptDice(page, [d20(10)]);
  await panel.getByRole("button", { name: `Roll ${attack} attack, +4` }).click();
  await expect(panel.getByRole("status", { name: "Latest roll" })).toContainText("14");
  await expect(panel.getByText("✓ All changes saved")).toBeVisible();

  // The map's tools still work with the sheet open.
  const measure = view.toolbar.getByRole("button", { name: "Measure" });
  await measure.click();
  await view.stroke(px(96, 96), px(288, 352));
  await expect(view.toolResult).toHaveText("25 ft");

  // It folds away for more map, and I opens the bag.
  await panel.getByRole("button", { name: "Fold the panel away" }).click();
  await expect(panel).toBeHidden();
  await page.keyboard.press("i");
  await expect(panel.getByRole("list", { name: "Inventory" })).toBeVisible();

  // The sheet keeps its change, and the panel stays open on the next visit.
  await panel.getByRole("tab", { name: "Sheet" }).click();
  await view.open();
  await expect(sheet.counter(feature, panel)).toHaveAccessibleName(`${feature}: 1 of 2 left`);
});

test("a player's panel offers only their own sheet and the shared companion", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL] });
  const player = await openAs("playerOne");
  // Started if no test has yet: only characters with a sheet can be opened beside the map.
  await player.characters.openSheet("Fixture PC One");
  await player.characters.openSheet("Fixture Companion");
  const view = await player.maps.view(map);
  const panel = view.page.getByRole("complementary", { name: "Side panel" });
  await panel.getByRole("tab", { name: "Sheet" }).click();

  const whose = panel.getByLabel("Whose");
  await expect(whose.getByRole("option")).toHaveText(["Fixture PC One", "Fixture Companion"]);
  await whose.selectOption({ label: "Fixture Companion" });
  await expect(panel.getByRole("heading", { name: "Fixture Companion" })).toBeVisible();
});
