import { expect, test as base } from "./support/fixtures";
import { canvasOf, MapEditor } from "./pages/maps";
import type { Api } from "./support/api";
import type { Maps } from "./pages/maps";
import { IMAGES, REVEAL_ALL, rectangle, uniqueName } from "./support/test-data";

/**
 * Interactive maps, made from the placeholder images in the fixture vault's Maps folder
 * ("Fixture World.png" is 400×200, "Fixture Town.png" 200×200). Maps are kept in the server's
 * data folder, which every test shares, so each test makes its own uniquely named maps. Only
 * the first test makes its map through the "New map" form; the rest use the API.
 */

/** A rectangle in the world map's left half, clear of the drawing toolbar. */
const HARBOUR = rectangle([0.2, 0.4], [0.4, 0.8]);

const test = base.extend<{ harbour: MapEditor }>({
  /** A world map with "Harbour" drawn and selected, open in the editor. */
  harbour: async ({ api, maps }, use) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await editor.drawArea(HARBOUR, "Harbour");
    await expect(editor.vertexHandles("Harbour")).toHaveCount(4);
    await editor.saved();
    await use(editor);
  },
});

test.describe("Maps", () => {
  test("makes a map from a vault image, and keeps it after a reload", async ({ maps, page }) => {
    const editor = await maps.create({
      image: IMAGES.world,
      name: uniqueName("World"),
      note: "Locations/Fixture Town",
    });
    const view = await editor.done();
    const { name } = view.map;

    await expect(view.breadcrumbs).toContainText(name);
    await expect(view.zoomLevel).toHaveText("100%");
    const note = page.getByRole("region", { name: "Note: Fixture Town" });
    await expect(note).toContainText("the note linked to a map");

    await view.reload();
    await expect(view.canvas).toBeVisible();
    await maps.open();
    await maps.tree.getByRole("link", { name, exact: true }).click();
    await expect(view.canvas).toBeVisible();
  });

  test("zooms in and back out to fit", async ({ api, maps, page }) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(editor.zoomLevel).toHaveText("150%");
    await editor.canvas.press("+");
    await expect(editor.zoomLevel).toHaveText("225%");
    await page.getByRole("button", { name: "Fit" }).click();
    await expect(editor.zoomLevel).toHaveText("100%");
  });

  test("serves the map's image by map, not by file name", async ({ api, maps, page }) => {
    await maps.edit(await api.createMap({ image: IMAGES.town }));
    const src = await page.locator("svg image").getAttribute("href");
    expect(src).toMatch(/^\/maps\/[0-9a-f]+\/image\?v=/);
    expect(src).not.toContain("Fixture");

    const first = await api.request.get(src!);
    expect(first.status()).toBe(200);
    expect(first.headers()["content-type"]).toBe("image/png");
    const again = await api.request.get(src!, {
      headers: { "If-None-Match": first.headers()["etag"] },
    });
    expect(again.status()).toBe(304);
  });

  test("shows a not-found page for a map that doesn't exist", async ({ maps, page }) => {
    const response = await maps.goto("/maps/no-such-map");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Map not found" })).toBeVisible();
  });

  test("that aren't shared look missing to players, images and all", async ({
    api,
    maps,
    page,
  }) => {
    const map = await api.createMap({ image: IMAGES.town });
    const editor = await maps.edit(map);
    const src = await page.locator("svg image").getAttribute("href");

    await editor.previewAsPlayer();
    await editor.navLink("Maps").click();
    await expect(page.getByRole("heading", { name: "Maps", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: map.name })).toHaveCount(0);
    for (const url of [`${map.url}/edit`, map.url]) {
      expect((await maps.goto(url))?.status()).toBe(404);
    }
    expect((await api.request.get(src!)).status()).toBe(404);
    expect((await api.changeFogRequest(map, REVEAL_ALL)).status()).toBe(404);
  });

  test("saves the DM's fog changes", async ({ api }) => {
    const map = await api.createMap({ image: IMAGES.world });
    const response = await api.changeFog(map, REVEAL_ALL);
    expect(await response.json()).toEqual({
      fog: { cols: 512, rows: 256, cells: "0.2t4w", version: 1 },
    });
  });
});

test.describe("Drawing areas", () => {
  test("draws an area, names it, and keeps it after a reload", async ({ api, maps, page }) => {
    const map = await api.createMap({ image: IMAGES.world });
    const editor = await maps.edit(map);
    await expect(page.getByRole("heading", { name: `Editing ${map.name}` })).toBeAttached();

    await editor.drawArea(HARBOUR, "Harbour");
    await editor.saved();

    await editor.reload();
    await expect(editor.areas.getByRole("button", { name: /Harbour/ })).toBeVisible();

    await editor.done();
    await page.getByRole("button", { name: "Harbour, not mapped yet" }).click();
    await expect(page.getByRole("region", { name: "Harbour" })).toContainText("Not mapped yet");
  });

  test("undoes and redoes a new area", async ({ api, maps, page }) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await editor.drawArea(HARBOUR);
    await expect(editor.areas.getByRole("button")).toHaveCount(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(editor.areas).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(editor.areas.getByRole("button", { name: /New area/ })).toBeVisible();
  });

  test("cancels a half-drawn area with Escape, and saves nothing", async ({ api, maps, page }) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await page.getByRole("button", { name: "Draw area" }).click();
    await editor.click([0.3, 0.5]);
    await expect(page.getByRole("button", { name: "Finish area" })).toBeDisabled();
    await editor.canvas.press("Escape");

    await expect(page.getByRole("button", { name: "Draw area" })).toBeVisible();
    await editor.reload();
    await expect(page.getByText("None yet.")).toBeVisible();
  });

  test("deletes an area", async ({ harbour, page }) => {
    await page.getByRole("button", { name: "Delete area…" }).click();
    await page.getByRole("button", { name: "Delete Harbour" }).click();
    await expect(harbour.areas).toHaveCount(0);
    await harbour.saved();
    await harbour.reload();
    await expect(page.getByText("None yet.")).toBeVisible();
  });
});

test.describe("Reshaping areas", () => {
  test("nudges a point with the arrow keys, and undoes the nudges in one step", async ({
    harbour,
    page,
  }) => {
    const before = await harbour.vertexPosition("Harbour", 1);
    const point = () => harbour.vertexPosition("Harbour", 1);

    // Each press waits for the point to move, since the handle is drawn again after each.
    await harbour.vertexHandles("Harbour").first().press("Shift+ArrowRight");
    await expect.poll(async () => (await point()).x).toBeCloseTo(before.x + 1, 1);
    await harbour.vertexHandles("Harbour").first().press("Shift+ArrowRight");
    await expect.poll(async () => (await point()).x).toBeCloseTo(before.x + 2, 1);
    await harbour.vertexHandles("Harbour").first().press("ArrowDown");
    await expect.poll(async () => (await point()).y).toBeCloseTo(before.y + 0.1, 1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(point).toEqual(before);
  });

  test("drags a point to a new place", async ({ harbour }) => {
    const before = await harbour.vertexPosition("Harbour", 3);
    const canvas = (await harbour.canvas.boundingBox())!;
    await harbour.dragVertex("Harbour", 3, { x: canvas.width / 10, y: 0 });

    await expect
      .poll(async () => (await harbour.vertexPosition("Harbour", 3)).x)
      .toBeGreaterThan(before.x + 5);
    const after = await harbour.vertexPosition("Harbour", 3);
    expect(after.y).toBeCloseTo(before.y, 0);
    await harbour.saved();
    await harbour.reload();
    await harbour.areas.getByRole("button", { name: /Harbour/ }).click();
    expect(await harbour.vertexPosition("Harbour", 3)).toEqual(after);
  });

  test("adds a point between two others, and removes one", async ({ harbour, page }) => {
    await page.getByRole("button", { name: "Add a point to Harbour after point 1" }).click();
    await expect(harbour.vertexHandles("Harbour")).toHaveCount(5);

    await harbour.vertexHandles("Harbour").nth(1).press("Delete");
    await expect(harbour.vertexHandles("Harbour")).toHaveCount(4);
  });

  test("never removes points below a triangle", async ({ harbour }) => {
    await harbour.vertexHandles("Harbour").first().press("Delete");
    await expect(harbour.vertexHandles("Harbour")).toHaveCount(3);
    await harbour.vertexHandles("Harbour").first().press("Delete");
    await expect(harbour.vertexHandles("Harbour")).toHaveCount(3);
  });
});

test.describe("Linking maps", () => {
  test("links an area to a new map, clicks through, and comes back up", async ({
    api,
    maps,
    page,
  }) => {
    const world = await api.createMap({ image: IMAGES.world });
    const editor = await maps.edit(world);
    await editor.drawArea(HARBOUR, "Riverside");
    await page.getByLabel("Wiki note", { exact: true }).fill("Locations/Fixture Town");
    await editor.linkNewMap(IMAGES.town.file);
    await expect(page.getByLabel("Leads to map").locator("option:checked")).toHaveText("Riverside");
    const view = await editor.done();

    // Down into the new map, which starts with the area's note.
    await view.canvas.getByRole("link", { name: "Riverside" }).click();
    const riverside = canvasOf(page, "Riverside");
    await expect(riverside).toBeVisible();
    await expect(view.breadcrumbs.getByRole("link", { name: world.name })).toBeVisible();
    await expect(page.getByRole("region", { name: "Note: Fixture Town" })).toBeVisible();

    // An area on the child map, so there are three levels.
    await page.getByRole("link", { name: "Edit map" }).click();
    await expect(page).toHaveURL(/\/edit$/);
    const child = new MapEditor(page, await maps.current("Riverside", IMAGES.town));
    await expect(child.canvas).toBeVisible();
    await child.drawArea(
      [
        [0.3, 0.4],
        [0.6, 0.4],
        [0.6, 0.7],
      ],
      "Keep",
    );
    await child.saved();
    await child.done();
    await expect(riverside.getByRole("button", { name: "Keep, not mapped yet" })).toBeVisible();

    // Back up by the breadcrumbs, and everything is still there after a reload.
    await view.breadcrumbs.getByRole("link", { name: world.name }).click();
    await expect(view.canvas).toBeVisible();
    await view.reload();
    await expect(view.canvas.getByRole("link", { name: "Riverside" })).toBeVisible();
    await maps.open();
    await expect(maps.tree.getByRole("listitem").filter({ hasText: world.name })).toContainText(
      "Riverside",
    );
  });
});

test.describe("Viewing maps", () => {
  /** A world map with a "Riverside" area leading to a town map, open in the view. */
  async function worldWithTown(api: Api, maps: Maps) {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await editor.drawArea(HARBOUR, "Riverside");
    await editor.linkNewMap(IMAGES.town.file);
    return editor.done();
  }

  test("previews maps on the Maps page, and looks inside one by its pin", async ({
    api,
    maps,
    page,
  }) => {
    const world = (await worldWithTown(api, maps)).map;
    await maps.open();
    const preview = await maps.previewMap(world.name);
    const thumbnail = preview.locator("img").first();
    await expect(thumbnail).toHaveAttribute("src", /^\/maps\/[^/]+\/thumbnail\?v=/);
    await expect(preview).toContainText("1 map inside");

    // The pin for the map inside previews it, with where it is in the world.
    await maps.pin(preview, "Riverside").click();
    const riverside = maps.preview("Riverside");
    await expect(riverside.getByRole("navigation", { name: "Where it is" })).toContainText(
      world.name,
    );
    await riverside.getByRole("button", { name: `In ${world.name}: preview it` }).click();
    await expect(maps.preview(world.name)).toBeVisible();

    // Pointing anywhere on a row previews it, not only at its name.
    await maps.pin(maps.preview(world.name), "Riverside").click();
    await expect(maps.preview("Riverside")).toBeVisible();
    await maps.pointAtRow(world.name);
    await expect(maps.preview(world.name)).toBeVisible();

    await maps.preview(world.name).getByRole("link", { name: "Open map" }).click();
    await expect(canvasOf(page, world.name)).toBeVisible();
  });

  test("dives into an area's map from the keyboard", async ({ api, maps, page }) => {
    const view = await worldWithTown(api, maps);
    await view.canvas.focus();
    await page.keyboard.press("Tab");
    await expect(view.canvas.getByRole("link", { name: "Riverside" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(canvasOf(page, "Riverside")).toBeVisible();
  });

  test("shows areas as pins, with their outlines and names on hover, from the list, or with Places", async ({
    api,
    maps,
    page,
  }) => {
    const view = await worldWithTown(api, maps);
    const name = view.areaName("Riverside");
    await expect(name).toHaveCSS("opacity", "0");

    await view.canvas.getByRole("link", { name: "Riverside" }).hover();
    await expect(name).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    await expect(name).toHaveCSS("opacity", "0");

    await page
      .getByRole("list", { name: "Areas" })
      .getByRole("link", { name: "Riverside" })
      .hover();
    await expect(name).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    await expect(name).toHaveCSS("opacity", "0");

    await view.placesButton.click();
    await expect(view.placesButton).toHaveAttribute("aria-pressed", "true");
    await expect(name).toHaveCSS("opacity", "1");
    await view.canvas.press("p");
    await expect(view.placesButton).toHaveAttribute("aria-pressed", "false");
    await expect(name).toHaveCSS("opacity", "0");
  });

  test("opens an area that isn't mapped yet in the side panel, with a way to attach a map", async ({
    api,
    maps,
    page,
  }) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await editor.drawArea(HARBOUR, "Old Quarry");
    await page.getByLabel("Wiki note", { exact: true }).fill("Locations/Fixture Town");
    await editor.saved();
    const view = await editor.done();

    await expect(page.getByText("Not mapped yet", { exact: true })).toBeVisible();
    await view.canvas.getByRole("button", { name: "Old Quarry, not mapped yet" }).click();
    const panel = page.getByRole("region", { name: "Old Quarry" });
    await expect(panel).toContainText("Not mapped yet.");
    await expect(panel.getByRole("region", { name: "Note: Fixture Town" })).toBeVisible();

    await panel.getByRole("link", { name: "Attach a map" }).click();
    await expect(editor.areaName).toHaveValue("Old Quarry");
    await expect(page.getByLabel("Leads to map")).toBeVisible();
  });

  test("follows links in the map's note without leaving the app", async ({ api, maps, page }) => {
    await maps.view(await api.createMap({ image: IMAGES.world, note: "Locations/Fixture Town" }));
    await page
      .getByRole("region", { name: "Note: Fixture Town" })
      .getByRole("link", { name: "Brindleford" })
      .click();
    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
  });

  test("links a wiki note to the maps of it, for the DM only", async ({ api, page, wiki }) => {
    const map = await api.createMap({ image: IMAGES.town, note: "Locations/Fixture Town" });
    await wiki.openNote("Locations/Fixture Town");
    await page.getByRole("link", { name: `Open map: ${map.name}` }).click();
    await expect(canvasOf(page, map.name)).toBeVisible();

    await wiki.openNote("Locations/Fixture Town");
    await wiki.previewAsPlayer();
    await expect(page.getByRole("link", { name: /Open map/ })).toHaveCount(0);
  });

  test("presents just the map", async ({ api, maps, page }) => {
    const view = await worldWithTown(api, maps);
    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.getByRole("button", { name: "Stop presenting" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Map details" })).toHaveCount(0);
    await expect(view.canvas.getByRole("link", { name: "Riverside" })).toBeVisible();

    await page.getByRole("button", { name: "Stop presenting" }).click();
    await expect(page.getByRole("complementary", { name: "Map details" })).toBeVisible();
  });
});

test.describe("Areas on a touch screen", () => {
  test.use({ hasTouch: true });

  test("shows an area on the first tap, and opens its map on the second", async ({
    api,
    maps,
    page,
  }) => {
    const editor = await maps.edit(await api.createMap({ image: IMAGES.world }));
    await editor.drawArea(HARBOUR, "Riverside");
    await editor.linkNewMap(IMAGES.town.file);
    const view = await editor.done();

    const area = view.canvas.getByRole("link", { name: "Riverside" });
    await area.tap();
    await expect(view.areaName("Riverside")).toHaveCSS("opacity", "1");
    await expect(view.canvas).toBeVisible();
    await area.tap();
    await expect(canvasOf(page, "Riverside")).toBeVisible();
  });
});
