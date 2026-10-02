import { expect, test } from "./support/fixtures";
import { REVEAL_ALL, SQUARES_64, uniqueName } from "./support/test-data";

/**
 * Battle maps: a grid of 5 ft squares over any map, set up in the editor. Tests start as the DM.
 * "Fixture Fog.png" is 1024×512: no common square size fits it with 10 or more squares, so the
 * grid starts at about 20 squares across.
 */

/** A point on the fog fixture in pixels, as fractions of the image. */
const px = (x: number, y: number): [number, number] => [x / 1024, y / 512];

test("the DM turns a map into a battle map, scales its grid, and players see it", async ({
  api,
  maps,
  openAs,
  page,
}) => {
  const map = await api.createMap({ name: uniqueName("Battle") });
  const editor = await maps.edit(map);

  const grid = await editor.gridSettings();
  await grid.getByLabel("A grid of 5 ft squares over the map").check();
  await expect(grid).toContainText("Scale: about 20 × 10 squares");
  await grid.getByLabel("Square size in pixels").fill("32");
  await expect(grid).toContainText("Scale: about 32 × 16 squares");
  await grid.getByRole("button", { name: "Offset right" }).click();
  await expect(grid.getByLabel("Offset across in pixels")).toHaveValue("0.5");
  await editor.saved();

  // Kept with the map, and drawn on its page.
  await editor.reload();
  await expect((await editor.gridSettings()).getByLabel("Square size in pixels")).toHaveValue("32");
  await maps.view(map);
  await expect(page.getByRole("img", { name: "Battle grid" })).toBeAttached();

  // Players get it on a shared map, only over what's revealed.
  await api.share(map);
  await api.changeFog(map, REVEAL_ALL);
  const player = await openAs("playerOne");
  await player.maps.view(map);
  const playerGrid = player.page.getByRole("img", { name: "Battle grid" });
  await expect(playerGrid).toBeAttached();
  await expect(playerGrid).toHaveAttribute("mask", /^url\(#/);
});

test("the DM hides the grid's lines where the image has its own, and takes the grid off", async ({
  api,
  maps,
  page,
}) => {
  const editor = await maps.edit(await api.createMap({ name: uniqueName("Lines") }));
  const grid = await editor.gridSettings();
  const onOff = grid.getByLabel("A grid of 5 ft squares over the map");
  await onOff.check();
  await expect(grid.getByLabel("Grid scale")).toBeVisible();
  await grid.getByLabel("Line strength").fill("0");
  await expect(grid).toContainText("Lines: hidden (the image has its own)");
  await onOff.uncheck();
  await expect(grid.getByLabel("Grid scale")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(grid.getByLabel("Grid scale")).toBeVisible();
});

test("anyone measures real distances on a battle map, and changing tool tidies up", async ({
  api,
  maps,
  page,
}) => {
  const view = await maps.view(
    await api.createMap({ name: uniqueName("Ruler"), grid: SQUARES_64 }),
  );

  const measure = view.toolbar.getByRole("button", { name: "Measure" });
  await measure.click();
  await expect(measure).toHaveAttribute("aria-pressed", "true");

  // Three squares across and four down: a true length of 25 ft, not the 20 of counting squares.
  await view.stroke(px(96, 96), px(288, 352));
  await expect(view.toolResult).toHaveText("25 ft");

  // Choosing another tool (here by its key) clears the ruler.
  await page.keyboard.press("v");
  await expect(view.toolbar.getByRole("button", { name: "Select and move" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(view.toolResult).toHaveCount(0);
});

test("maps without a grid have no measuring tools", async ({ api, maps }) => {
  const view = await maps.view(await api.createMap({ name: uniqueName("Plain") }));
  await expect(view.toolbar).toHaveCount(0);
});

test("spell areas show the squares they cover and who's caught, named as spells name them", async ({
  api,
  maps,
  page,
}) => {
  const map = await api.createMap({ name: uniqueName("Fireball"), grid: SQUARES_64 });
  // A marker in the square just below and right of the corner at (320, 256).
  const marker = uniqueName("Goblin");
  await api.placeMarker(map, marker, px(352, 288));
  const view = await maps.view(map);

  await view.toolbar.getByRole("button", { name: "Spell area" }).click();
  const options = page.getByRole("group", { name: "Spell area" });
  for (const shape of ["Sphere", "Cube", "Cone", "Line"]) {
    await expect(options.getByRole("button", { name: shape })).toBeVisible();
  }
  await options.getByRole("button", { name: "10 ft" }).click();

  // A 10 ft sphere on the corner catches the marker; a cone aimed away from it doesn't.
  const at = await view.at(px(322, 254));
  await page.mouse.click(at.x, at.y);
  await expect(view.toolResult).toHaveText(`In the area: ${marker}`);

  await options.getByRole("button", { name: "Cone" }).click();
  await view.stroke(px(322, 254), px(100, 100), 5);
  await expect(view.toolResult).toHaveText("In the area: nobody");

  await page.keyboard.press("Escape");
  await expect(view.toolResult).toHaveCount(0);
});
