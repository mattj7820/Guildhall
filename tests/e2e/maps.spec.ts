import { expect, test, type Page } from "@playwright/test";
import {
  breadcrumbs,
  createMap,
  drawArea,
  editorAreas,
  expectSaved,
  linkNewMap,
  mapCanvas,
  openNote,
  ORIGIN,
  switchToPlayerView,
  uniqueName,
  vertexHandles,
  vertexPosition,
  zoomLevel,
} from "./support/app";

/**
 * Interactive maps, made from the placeholder images in the fixture vault's Maps folder
 * ("Fixture World.png" is 400×200, "Fixture Town.png" 200×200). Maps are kept in the server's
 * data folder, which every test shares, so each test makes its own uniquely named maps.
 */

test.describe("Maps", () => {
  test("makes a map from a vault image, and keeps it after a reload", async ({ page }) => {
    const name = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name, note: "Locations/Fixture Town" });
    await page.getByRole("link", { name: "Done" }).click();

    await expect(breadcrumbs(page)).toContainText(name);
    await expect(zoomLevel(page)).toHaveText("100%");
    const note = page.getByRole("region", { name: "Note: Fixture Town" });
    await expect(note).toContainText("the note linked to a map");

    await page.reload();
    await expect(mapCanvas(page, name)).toBeVisible();
    await page.goto("/maps");
    await page
      .getByRole("navigation", { name: "All maps" })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(mapCanvas(page, name)).toBeVisible();
  });

  test("zooms in and back out to fit", async ({ page }) => {
    const name = uniqueName("Zoom");
    await createMap(page, { image: "Fixture World.png", name });

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoomLevel(page)).toHaveText("150%");
    await mapCanvas(page, name).press("+");
    await expect(zoomLevel(page)).toHaveText("225%");
    await page.getByRole("button", { name: "Fit" }).click();
    await expect(zoomLevel(page)).toHaveText("100%");
  });

  test("serves the map's image by map, not by file name", async ({ page }) => {
    await createMap(page, { image: "Fixture Town.png", name: uniqueName("Town") });
    const src = await page.locator("svg image").getAttribute("href");
    expect(src).toMatch(/^\/maps\/[0-9a-f]+\/image\?v=/);
    expect(src).not.toContain("Fixture");

    const first = await page.request.get(src!);
    expect(first.status()).toBe(200);
    expect(first.headers()["content-type"]).toBe("image/png");
    const again = await page.request.get(src!, {
      headers: { "If-None-Match": first.headers()["etag"] },
    });
    expect(again.status()).toBe(304);
  });

  test("shows a not-found page for a map that doesn't exist", async ({ page }) => {
    const response = await page.goto("/maps/no-such-map");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Map not found" })).toBeVisible();
  });

  test("are DM-only, including their images", async ({ page }) => {
    await createMap(page, { image: "Fixture Town.png", name: uniqueName("Secret") });
    const mapPage = page.url();
    const src = await page.locator("svg image").getAttribute("href");

    await switchToPlayerView(page);
    await expect(page.getByText("Maps are DM-only for now.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).not.toContainText("Maps");
    await page.goto(mapPage);
    await expect(page.getByText("Maps are DM-only for now.")).toBeVisible();
    expect((await page.request.get(src!)).status()).toBe(404);
    const reveal = await page.request.post(mapPage.replace(/\/edit$/, "/fog"), {
      headers: { Origin: ORIGIN },
      data: { changes: [REVEAL_ALL] },
    });
    expect(reveal.status()).toBe(404);
  });

  test("saves the DM's fog changes", async ({ page }) => {
    await createMap(page, { image: "Fixture World.png", name: uniqueName("Fogged") });
    const fog = page.url().replace(/\/edit$/, "/fog");
    const response = await page.request.post(fog, {
      headers: { Origin: ORIGIN },
      data: { changes: [REVEAL_ALL] },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      fog: { cols: 512, rows: 256, cells: "0.2t4w", version: 1 },
    });
  });
});

const REVEAL_ALL = { type: "paint", mode: "reveal", shape: { kind: "all" } };
const WORLD = { width: 400, height: 200 };
/** A rectangle in the world map's left half, clear of the drawing toolbar. */
const HARBOUR: [number, number][] = [
  [0.2, 0.4],
  [0.4, 0.4],
  [0.4, 0.8],
  [0.2, 0.8],
];

test.describe("Drawing areas", () => {
  test("draws an area, names it, and keeps it after a reload", async ({ page }) => {
    const name = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name });
    await expect(page.getByRole("heading", { name: `Editing ${name}` })).toBeAttached();

    await drawArea(page, name, WORLD, HARBOUR);
    await page.getByLabel("Area name").fill("Harbour");
    await expectSaved(page);

    await page.reload();
    await expect(editorAreas(page).getByRole("button", { name: /Harbour/ })).toBeVisible();

    await page.getByRole("link", { name: "Done" }).click();
    await page.getByRole("button", { name: "Harbour, not mapped yet" }).click();
    await expect(page.getByRole("region", { name: "Harbour" })).toContainText("Not mapped yet");
  });

  test("undoes and redoes a new area", async ({ page }) => {
    const name = uniqueName("Undo");
    await createMap(page, { image: "Fixture World.png", name });
    await drawArea(page, name, WORLD, HARBOUR);
    await expect(editorAreas(page).getByRole("button")).toHaveCount(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(editorAreas(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(editorAreas(page).getByRole("button", { name: /New area/ })).toBeVisible();
  });

  test("cancels a half-drawn area with Escape, and saves nothing", async ({ page }) => {
    const name = uniqueName("Cancel");
    await createMap(page, { image: "Fixture World.png", name });
    await page.getByRole("button", { name: "Draw area" }).click();
    await mapCanvas(page, name).click({ position: { x: 100, y: 200 } });
    await expect(page.getByRole("button", { name: "Finish area" })).toBeDisabled();
    await mapCanvas(page, name).press("Escape");

    await expect(page.getByRole("button", { name: "Draw area" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("None yet.")).toBeVisible();
  });

  test("deletes an area", async ({ page }) => {
    const name = uniqueName("Delete");
    await createMap(page, { image: "Fixture World.png", name });
    await drawArea(page, name, WORLD, HARBOUR);
    await page.getByRole("button", { name: "Delete area…" }).click();
    await page.getByRole("button", { name: "Delete New area" }).click();
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("None yet.")).toBeVisible();
  });
});

test.describe("Reshaping areas", () => {
  async function mapWithArea(page: Page) {
    const name = uniqueName("Shape");
    await createMap(page, { image: "Fixture World.png", name });
    await drawArea(page, name, WORLD, HARBOUR);
    await page.getByLabel("Area name").fill("Harbour");
    await expect(vertexHandles(page, "Harbour")).toHaveCount(4);
    return name;
  }

  test("nudges a point with the arrow keys, and undoes the nudges in one step", async ({
    page,
  }) => {
    await mapWithArea(page);
    const before = await vertexPosition(page, "Harbour", 1);

    const handle = vertexHandles(page, "Harbour").first();
    await handle.focus();
    await handle.press("Shift+ArrowRight");
    await vertexHandles(page, "Harbour").first().press("Shift+ArrowRight");
    await vertexHandles(page, "Harbour").first().press("ArrowDown");
    const after = await vertexPosition(page, "Harbour", 1);
    expect(after.x).toBeCloseTo(before.x + 2, 1);
    expect(after.y).toBeCloseTo(before.y + 0.1, 1);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await vertexPosition(page, "Harbour", 1)).toEqual(before);
  });

  test("drags a point to a new place", async ({ page }) => {
    const name = await mapWithArea(page);
    const before = await vertexPosition(page, "Harbour", 3);
    const box = (await vertexHandles(page, "Harbour").nth(2).boundingBox())!;
    const canvas = (await mapCanvas(page, name).boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + canvas.width / 10, box.y + box.height / 2, {
      steps: 5,
    });
    await page.mouse.up();

    const after = await vertexPosition(page, "Harbour", 3);
    expect(after.x).toBeGreaterThan(before.x + 5);
    expect(after.y).toBeCloseTo(before.y, 0);
    await expectSaved(page);
    await page.reload();
    await editorAreas(page)
      .getByRole("button", { name: /Harbour/ })
      .click();
    expect(await vertexPosition(page, "Harbour", 3)).toEqual(after);
  });

  test("adds a point between two others, and removes one", async ({ page }) => {
    await mapWithArea(page);
    await page.getByRole("button", { name: "Add a point to Harbour after point 1" }).click();
    await expect(vertexHandles(page, "Harbour")).toHaveCount(5);

    await vertexHandles(page, "Harbour").nth(1).press("Delete");
    await expect(vertexHandles(page, "Harbour")).toHaveCount(4);
  });

  test("never removes points below a triangle", async ({ page }) => {
    await mapWithArea(page);
    await vertexHandles(page, "Harbour").first().press("Delete");
    await expect(vertexHandles(page, "Harbour")).toHaveCount(3);
    await vertexHandles(page, "Harbour").first().press("Delete");
    await expect(vertexHandles(page, "Harbour")).toHaveCount(3);
  });
});

test.describe("Linking maps", () => {
  test("links an area to a new map, clicks through, and comes back up", async ({ page }) => {
    const world = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name: world });
    await drawArea(page, world, WORLD, HARBOUR);
    await page.getByLabel("Area name").fill("Riverside");
    await page.getByLabel("Wiki note", { exact: true }).fill("Locations/Fixture Town");

    await page.getByRole("button", { name: "New map from image…" }).click();
    const newMap = page.getByRole("group", { name: "New map for this area" });
    await newMap.getByRole("searchbox", { name: "Find an image" }).fill("Fixture Town");
    await newMap.getByRole("radio", { name: /Fixture Town\.png$/ }).check();
    await expect(newMap.getByText("200 × 200 pixels")).toBeVisible();
    await newMap.getByRole("button", { name: "Create and link" }).click();
    await expect(page.getByLabel("Leads to map").locator("option:checked")).toHaveText("Riverside");
    await expectSaved(page);
    await page.getByRole("link", { name: "Done" }).click();

    // Down into the new map, which starts with the area's note.
    await mapCanvas(page, world).getByRole("link", { name: "Riverside" }).click();
    await expect(mapCanvas(page, "Riverside")).toBeVisible();
    await expect(breadcrumbs(page).getByRole("link", { name: world })).toBeVisible();
    await expect(page.getByRole("region", { name: "Note: Fixture Town" })).toBeVisible();

    // An area on the child map, so there are three levels.
    await page.getByRole("link", { name: "Edit map" }).click();
    await drawArea(page, "Riverside", { width: 200, height: 200 }, [
      [0.3, 0.4],
      [0.6, 0.4],
      [0.6, 0.7],
    ]);
    await page.getByLabel("Area name").fill("Keep");
    await expectSaved(page);
    await page.getByRole("link", { name: "Done" }).click();
    await expect(
      mapCanvas(page, "Riverside").getByRole("button", { name: "Keep, not mapped yet" }),
    ).toBeVisible();

    // Back up by the breadcrumbs, and everything is still there after a reload.
    await breadcrumbs(page).getByRole("link", { name: world }).click();
    await expect(mapCanvas(page, world)).toBeVisible();
    await page.reload();
    await expect(mapCanvas(page, world).getByRole("link", { name: "Riverside" })).toBeVisible();
    await page.goto("/maps");
    const list = page.getByRole("navigation", { name: "All maps" });
    await expect(list.getByRole("listitem").filter({ hasText: world })).toContainText("Riverside");
  });
});

test.describe("Viewing maps", () => {
  /** A world map with a "Riverside" area leading to a town map, open in the view. */
  async function worldWithTown(page: Page) {
    const world = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name: world });
    await drawArea(page, world, WORLD, HARBOUR);
    await page.getByLabel("Area name").fill("Riverside");
    await linkNewMap(page, "Fixture Town.png");
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("link", { name: "Edit map" })).toBeVisible();
    return world;
  }

  test("dives into an area's map from the keyboard", async ({ page }) => {
    const world = await worldWithTown(page);
    await mapCanvas(page, world).focus();
    await page.keyboard.press("Tab");
    await expect(mapCanvas(page, world).getByRole("link", { name: "Riverside" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(mapCanvas(page, "Riverside")).toBeVisible();
  });

  test("opens an area that isn't mapped yet in the side panel, with a way to attach a map", async ({
    page,
  }) => {
    const name = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name });
    await drawArea(page, name, WORLD, HARBOUR);
    await page.getByLabel("Area name").fill("Old Quarry");
    await page.getByLabel("Wiki note", { exact: true }).fill("Locations/Fixture Town");
    await expectSaved(page);
    await page.getByRole("link", { name: "Done" }).click();

    await expect(page.getByText("Not mapped yet", { exact: true })).toBeVisible();
    await mapCanvas(page, name).getByRole("button", { name: "Old Quarry, not mapped yet" }).click();
    const panel = page.getByRole("region", { name: "Old Quarry" });
    await expect(panel).toContainText("Not mapped yet.");
    await expect(panel.getByRole("region", { name: "Note: Fixture Town" })).toBeVisible();

    await panel.getByRole("link", { name: "Attach a map" }).click();
    await expect(page.getByLabel("Area name")).toHaveValue("Old Quarry");
    await expect(page.getByLabel("Leads to map")).toBeVisible();
  });

  test("follows links in the map's note without leaving the app", async ({ page }) => {
    const name = uniqueName("World");
    await createMap(page, { image: "Fixture World.png", name, note: "Locations/Fixture Town" });
    await page.getByRole("link", { name: "Done" }).click();
    await page
      .getByRole("region", { name: "Note: Fixture Town" })
      .getByRole("link", { name: "Brindleford" })
      .click();
    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
  });

  test("links a wiki note to the maps of it, for the DM only", async ({ page }) => {
    const name = uniqueName("Town");
    await createMap(page, { image: "Fixture Town.png", name, note: "Locations/Fixture Town" });
    await openNote(page, "Locations/Fixture Town");
    await page.getByRole("link", { name: `Open map: ${name}` }).click();
    await expect(mapCanvas(page, name)).toBeVisible();

    await openNote(page, "Locations/Fixture Town");
    await switchToPlayerView(page);
    await expect(page.getByRole("link", { name: /Open map/ })).toHaveCount(0);
  });

  test("presents just the map", async ({ page }) => {
    const world = await worldWithTown(page);
    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.getByRole("button", { name: "Stop presenting" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Map details" })).toHaveCount(0);
    await expect(mapCanvas(page, world).getByRole("link", { name: "Riverside" })).toBeVisible();

    await page.getByRole("button", { name: "Stop presenting" }).click();
    await expect(page.getByRole("complementary", { name: "Map details" })).toBeVisible();
  });
});
