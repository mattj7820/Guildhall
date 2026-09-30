import { expect, test, type Page } from "@playwright/test";
import { createMap, expectSaved, ORIGIN, uniqueName } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Battle maps: a grid of 5 ft squares over any map, set up in the editor. Tests start as the DM.
 * "Fixture Fog.png" is 1024×512: no common square size fits it with 10 or more squares, so the
 * grid starts at about 20 squares across.
 */

async function gridSection(page: Page) {
  const section = page.locator("details", { hasText: "Battle map grid" });
  if (!(await section.getAttribute("open"))) await section.locator("summary").click();
  return section;
}

test("the DM turns a map into a battle map, scales its grid, and players see it", async ({
  page,
  browser,
}) => {
  const name = uniqueName("Battle");
  await createMap(page, { image: "Fixture Fog.png", name });
  const map = page.url().replace(/\/edit$/, "");

  const grid = await gridSection(page);
  await grid.getByLabel("A grid of 5 ft squares over the map").check();
  await expect(grid).toContainText("Scale: about 20 × 10 squares");
  await grid.getByLabel("Square size in pixels").fill("32");
  await expect(grid).toContainText("Scale: about 32 × 16 squares");
  await grid.getByRole("button", { name: "Offset right" }).click();
  await expect(grid.getByLabel("Offset across in pixels")).toHaveValue("0.5");
  await expectSaved(page);

  // Kept with the map, and drawn on its page.
  await page.reload();
  await expect((await gridSection(page)).getByLabel("Square size in pixels")).toHaveValue("32");
  await page.goto(map);
  await expect(page.getByRole("img", { name: "Battle grid" })).toBeAttached();

  // Players get it on a shared map, only over what's revealed.
  const post = (path: string, data: object) =>
    page.request.post(`${map}/${path}`, { headers: { Origin: ORIGIN }, data });
  await post("edit", { intent: "setVisibility", visibility: "players" });
  await post("fog", {
    changes: [{ type: "paint", mode: "reveal", shape: { kind: "all" } }],
  });
  const context = await browser.newContext({ storageState: SIGNED_IN.playerOne, baseURL: ORIGIN });
  const player = await context.newPage();
  await player.goto(map);
  const playerGrid = player.getByRole("img", { name: "Battle grid" });
  await expect(playerGrid).toBeAttached();
  expect(await playerGrid.getAttribute("mask")).toMatch(/^url\(#/);
  await context.close();
});

test("the DM hides the grid's lines where the image has its own, and takes the grid off", async ({
  page,
}) => {
  await createMap(page, { image: "Fixture Fog.png", name: uniqueName("Lines") });
  const grid = await gridSection(page);
  await grid.getByLabel("A grid of 5 ft squares over the map").check();
  await grid.getByLabel("Line strength").fill("0");
  await expect(grid).toContainText("Lines: hidden (the image has its own)");
  await grid.getByLabel("A grid of 5 ft squares over the map").uncheck();
  await expect(grid.getByLabel("Grid scale")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(grid.getByLabel("Grid scale")).toBeVisible();
});
