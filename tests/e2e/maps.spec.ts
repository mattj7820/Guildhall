import { expect, test } from "@playwright/test";
import {
  breadcrumbs,
  createMap,
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

    await expect(breadcrumbs(page)).toContainText(name);
    await expect(zoomLevel(page)).toHaveText("100%");
    const note = page.getByRole("region", { name: "Note: Fixture Town" });
    await expect(note).toContainText("the note linked to a map");

    await page.reload();
    await expect(mapCanvas(page, name)).toBeVisible();
    await page.goto("/maps");
    await page.getByRole("navigation", { name: "All maps" }).getByRole("link", { name }).click();
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
