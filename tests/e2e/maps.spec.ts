import { expect, test } from "@playwright/test";
import {
  breadcrumbs,
  createMap,
  drawArea,
  editorAreas,
  expectSaved,
  mapCanvas,
  switchToPlayerView,
  uniqueName,
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
  });
});

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
