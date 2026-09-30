import { expect, test, type Page } from "@playwright/test";
import { createMap, expectSaved, mapCanvas, onImage, ORIGIN, uniqueName } from "./support/app";
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

test("anyone measures real distances on a battle map, and changing tool tidies up", async ({
  page,
}) => {
  const name = uniqueName("Ruler");
  await createMap(page, { image: "Fixture Fog.png", name });
  const map = page.url().replace(/\/edit$/, "");
  // 64-pixel squares: 16 × 8 over the 1024×512 fixture.
  const saved = await page.request.post(`${map}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "save", name, areas: [], grid: { square: 0.0625, origin: [0, 0], lines: 0.4 } },
  });
  expect(saved.status()).toBe(200);
  await page.goto(map);

  const tools = page.getByRole("toolbar", { name: "Map tools" });
  await tools.getByRole("button", { name: "Measure" }).click();
  await expect(tools.getByRole("button", { name: "Measure" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Three squares across and four down: a true length of 25 ft, not the 20 of counting squares.
  const box = (await mapCanvas(page, name).boundingBox())!;
  const at = async (x: number, y: number) => {
    const point = await onImage(page, name, { width: 1024, height: 512 }, [x / 1024, y / 512]);
    return [box.x + point.x, box.y + point.y] as const;
  };
  await page.mouse.move(...(await at(96, 96)));
  await page.mouse.down();
  await page.mouse.move(...(await at(288, 352)), { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("status", { name: "Tool result" })).toHaveText("25 ft");

  // Choosing another tool (here by its key) clears the ruler.
  await page.keyboard.press("v");
  await expect(tools.getByRole("button", { name: "Select and move" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("status", { name: "Tool result" })).toHaveCount(0);
});

test("maps without a grid have no measuring tools", async ({ page }) => {
  await createMap(page, { image: "Fixture Fog.png", name: uniqueName("Plain") });
  await page.goto(page.url().replace(/\/edit$/, ""));
  await expect(page.getByRole("toolbar", { name: "Map tools" })).toHaveCount(0);
});

test("spell areas show the squares they cover and who's caught, named as spells name them", async ({
  page,
}) => {
  const name = uniqueName("Fireball");
  await createMap(page, { image: "Fixture Fog.png", name });
  const map = page.url().replace(/\/edit$/, "");
  const post = (path: string, data: object) =>
    page.request.post(`${map}/${path}`, { headers: { Origin: ORIGIN }, data });
  // 64-pixel squares; a marker in the square just below and right of the corner at (320, 256).
  await post("edit", {
    intent: "save",
    name,
    areas: [],
    grid: { square: 0.0625, origin: [0, 0], lines: 0.4 },
  });
  const marker = uniqueName("Goblin");
  const placed = await post("tokens", {
    actions: [
      {
        type: "place",
        token: {
          kind: "marker",
          id: marker,
          map: map.split("/").pop(),
          at: [352 / 1024, 288 / 512],
          name: marker,
          colour: "green",
          visibility: "dm",
        },
      },
    ],
  });
  expect(placed.status()).toBe(200);
  await page.goto(map);

  await page
    .getByRole("toolbar", { name: "Map tools" })
    .getByRole("button", { name: "Spell area" })
    .click();
  const options = page.getByRole("group", { name: "Spell area" });
  for (const shape of ["Sphere", "Cube", "Cone", "Line"]) {
    await expect(options.getByRole("button", { name: shape })).toBeVisible();
  }
  await options.getByRole("button", { name: "10 ft" }).click();

  // A 10 ft sphere on the corner catches the marker; a cone aimed away from it doesn't.
  const box = (await mapCanvas(page, name).boundingBox())!;
  const at = async (x: number, y: number) => {
    const point = await onImage(page, name, { width: 1024, height: 512 }, [x / 1024, y / 512]);
    return [box.x + point.x, box.y + point.y] as const;
  };
  await page.mouse.click(...(await at(322, 254)));
  const result = page.getByRole("status", { name: "Tool result" });
  await expect(result).toHaveText(`In the area: ${marker}`);

  await options.getByRole("button", { name: "Cone" }).click();
  await page.mouse.move(...(await at(322, 254)));
  await page.mouse.down();
  await page.mouse.move(...(await at(100, 100)), { steps: 5 });
  await page.mouse.up();
  await expect(result).toHaveText("In the area: nobody");

  await page.keyboard.press("Escape");
  await expect(result).toHaveCount(0);
});
