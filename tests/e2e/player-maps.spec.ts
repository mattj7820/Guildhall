import sharp from "sharp";
import { expect, test as base } from "./support/fixtures";
import type { Api } from "./support/api";
import {
  fogRect,
  HIDE_ALL,
  rectangle,
  REVEAL_ALL,
  uniqueName,
  type MapRef,
} from "./support/test-data";

/**
 * Maps for players, with fog of war. Tests start as the DM, who makes and shares maps; Player One
 * gets a second browser. "Fixture Fog.png" is 1024×512, in two 512-pixel tiles, with a magenta
 * square in its bottom-right corner (x 960 to 1023, y 448 to 511): the only magenta in it.
 */

/** The bottom-right corner, magenta and all: x from 896, y from 416. */
const HIDE_CORNER = fogRect("hide", [0.875, 0.8125], [1, 1]);
const LEFT_THIRD = fogRect("reveal", [0, 0], [0.3, 1]);

const area = (name: string, outline: [number, number][]) => ({
  id: name.toLowerCase(),
  name,
  outline,
  visibility: "players",
});
const KEEP = area("Keep", rectangle([0.05, 0.1], [0.25, 0.9]));
const CELLAR = area("Cellar", rectangle([0.6, 0.2], [0.9, 0.8]));

/** A map of the fog fixture with "Keep" over its left quarter. */
async function mapWithKeep(api: Api) {
  const map = await api.createMap({ name: uniqueName("Fog") });
  await api.saveMap(map, { areas: [KEEP] });
  return map;
}

const test = base.extend<{ explored: MapRef }>({
  /**
   * A shared map of the fog fixture with "Keep" in its left quarter, revealed, and "Cellar" on
   * its right, still under the fog.
   */
  explored: async ({ api }, use) => {
    const map = await api.createMap({ name: uniqueName("Explored") });
    await api.saveMap(map, { areas: [KEEP, CELLAR] });
    await api.share(map);
    await api.changeFog(map, LEFT_THIRD);
    await use(map);
  },
});

test("players get only revealed pixels of a shared map, never the whole image", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL, HIDE_CORNER] });

  const player = await openAs("playerOne");
  expect((await player.api.request.get(`${map.url}/image`)).status()).toBe(404);
  for (const tile of ["0/0", "1/0"]) {
    const response = await player.api.request.get(`${map.url}/tiles/${tile}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/webp");
    const { data } = await sharp(await response.body())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Counted in a plain loop: an assertion per pixel would be far too slow in Playwright.
    let magenta = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 180 && data[i + 1] < 90 && data[i + 2] > 180) magenta++;
    }
    expect(magenta, `magenta pixels in tile ${tile}`).toBe(0);
  }
});

test("players get no tile the fog hides entirely", async ({ api, openAs }) => {
  const map = await api.createMap({ shared: true, fog: [fogRect("reveal", [0, 0], [0.4, 1])] });

  const player = await openAs("playerOne");
  const tile = async (at: string) =>
    (await player.api.request.get(`${map.url}/tiles/${at}`)).status();
  expect(await tile("0/0")).toBe(200);
  expect(await tile("1/0")).toBe(404);
  expect(await tile("9/9")).toBe(404);
});

test("a map that isn't shared gives players nothing at all", async ({ api, openAs }) => {
  const map = await api.createMap({ fog: [REVEAL_ALL] });

  const player = await openAs("playerOne");
  expect((await player.api.request.get(`${map.url}/image`)).status()).toBe(404);
  expect((await player.api.request.get(`${map.url}/tiles/0/0`)).status()).toBe(404);
  expect((await player.api.changeFogRequest(map, REVEAL_ALL)).status()).toBe(404);
});

/** Counted in a plain loop: an assertion per pixel would be far too slow in Playwright. */
async function magentaIn(image: Buffer) {
  const { data } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let magenta = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 180 && data[i + 1] < 90 && data[i + 2] > 180 && data[i + 3] > 0) magenta++;
  }
  return magenta;
}

test("players' thumbnails have nothing from under the fog; the DM's have it all", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL, HIDE_CORNER] });
  const fogged = await api.createMap({ shared: true });
  const unshared = await api.createMap({ fog: [REVEAL_ALL] });

  const dm = await api.request.get(`${map.url}/thumbnail`);
  expect(dm.status()).toBe(200);
  expect(await magentaIn(await dm.body())).toBeGreaterThan(0);

  const player = await openAs("playerOne");
  const theirs = await player.api.request.get(`${map.url}/thumbnail`);
  expect(theirs.status()).toBe(200);
  expect(theirs.headers()["content-type"]).toBe("image/webp");
  expect(await magentaIn(await theirs.body())).toBe(0);
  // Nothing seen yet, not shared and missing are all the same 404.
  for (const other of [fogged.url, unshared.url, "/maps/no-such-map"]) {
    expect((await player.api.request.get(`${other}/thumbnail`)).status()).toBe(404);
  }
});

test("the Maps page shows players shared maps, with pins only where they've explored", async ({
  api,
  explored,
  openAs,
}) => {
  const keep = await api.createMap({ name: uniqueName("Keep"), shared: true });
  const cellar = await api.createMap({ name: uniqueName("Cellar"), shared: true });
  const secret = await api.createMap({ name: uniqueName("Secret") });
  await api.saveMap(explored, {
    areas: [
      { ...KEEP, map: keep.id },
      { ...CELLAR, map: cellar.id },
    ],
  });

  const player = await openAs("playerOne");
  await player.maps.open();
  await expect(player.maps.tree.getByRole("link", { name: secret.name })).toHaveCount(0);
  const preview = await player.maps.previewMap(explored.name);
  await expect(preview.locator("img").first()).toHaveAttribute("src", /\/thumbnail\?v=/);
  await expect(player.maps.pin(preview, keep.name)).toBeVisible();
  // Cellar is still under the fog: listed, as it's shared, but with no pin on the map.
  await expect(player.maps.pin(preview, cellar.name)).toHaveCount(0);
  await expect(preview.getByText(cellar.name)).toHaveCount(0);

  await player.maps.pin(preview, keep.name).click();
  const inside = player.maps.preview(keep.name);
  await expect(inside).toContainText("Not explored yet");
  await inside.getByRole("link", { name: "Open map" }).click();
  await expect(player.page).toHaveURL(new RegExp(`${keep.url}$`));
});

test.describe("The DM's fog tools", () => {
  test("shares a map from the editor, and keeps it shared", async ({ api, maps }) => {
    const editor = await maps.edit(await api.createMap());
    await expect(editor.shareSwitch).toHaveAttribute("aria-checked", "false");
    await editor.shareSwitch.click();
    await expect(editor.shareSwitch).toHaveAttribute("aria-checked", "true");
    // It's disabled until the server has saved it.
    await expect(editor.shareSwitch).toBeEnabled();
    await editor.reload();
    await expect(editor.shareSwitch).toHaveAttribute("aria-checked", "true");
  });

  test("reveals an area from the list, saves it, and hides it again", async ({
    api,
    maps,
    page,
  }) => {
    const view = await maps.view(await mapWithKeep(api));
    await view.openFog();
    const areas = page.getByRole("list", { name: "Areas under the fog" });
    await expect(areas.getByText("Under the fog")).toBeVisible();

    await page.getByRole("button", { name: "Reveal Keep" }).click();
    await expect(areas.getByText("Players see it")).toBeVisible();
    await view.fogSaved();

    await view.reload();
    await view.openFog();
    await expect(areas.getByText("Players see it")).toBeVisible();
    await page.getByRole("button", { name: "Hide Keep" }).click();
    await expect(areas.getByText("Under the fog")).toBeVisible();
    await view.fogSaved();
  });

  test("brushes the fog away, undoes it, and reveals and hides everything", async ({
    api,
    maps,
    page,
  }) => {
    const view = await maps.view(await mapWithKeep(api));
    await view.openFog();
    await expect(view.revealed).toHaveText("0% revealed");

    await view.stroke([0.3, 0.5], [0.7, 0.5], 10);
    await expect(view.revealed).not.toHaveText("0% revealed");
    await view.fogSaved();

    await page.keyboard.press("Control+z");
    await expect(view.revealed).toHaveText("0% revealed");
    await view.fogSaved();

    await view.fogToolbar.getByRole("button", { name: "Reveal all" }).click();
    await expect(view.revealed).toHaveText("100% revealed");
    await view.fogToolbar.getByRole("button", { name: "Hide all" }).click();
    await expect(view.revealed).toHaveText("0% revealed");
    await view.fogSaved();
    await view.reload();
    await view.openFog();
    await expect(view.revealed).toHaveText("0% revealed");
  });

  test("warns when players can see the whole image in the wiki anyway", async ({ maps, page }) => {
    // Mira Stonehand's shared note embeds her portrait.
    const portrait = await maps.create({
      image: "mira-portrait.png",
      name: uniqueName("Portrait"),
    });
    await portrait.done();
    await expect(page.getByRole("alert")).toContainText("embedded in a wiki note players can read");
  });

  test("doesn't warn about an image no shared note embeds", async ({ api, maps, page }) => {
    await maps.view(await api.createMap());
    await expect(page.getByRole("button", { name: "Fog", exact: true })).toBeVisible();
    await expect(page.getByText("embedded in a wiki note players can read")).toHaveCount(0);
  });

  test("keeps a secret area secret, however much is revealed", async ({ api, maps, page }) => {
    const editor = await maps.edit(await mapWithKeep(api));
    await editor.areas.getByRole("button", { name: /Keep/ }).click();
    await page.getByRole("checkbox", { name: /Secret/ }).check();
    await editor.saved();
    const view = await editor.done();

    await view.openFog();
    await view.fogToolbar.getByRole("button", { name: "Reveal all" }).click();
    await expect(
      page.getByRole("list", { name: "Areas under the fog" }).getByText("Secret"),
    ).toBeVisible();
  });
});

test.describe("Maps for players", () => {
  test("players find shared maps from the hub and the menu", async ({ explored, openAs }) => {
    const player = await openAs("playerOne");
    await player.goto("/");
    await expect(player.page.getByRole("link", { name: /^Maps/ }).first()).toBeVisible();
    await player.navLink("Maps").click();
    await player.page.getByRole("link", { name: explored.name }).click();
    await expect(player.page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText(
      explored.name,
    );
  });

  test("a player sees only what's revealed, and only the areas they can see", async ({
    explored,
    openAs,
  }) => {
    const player = await openAs("playerOne");
    const view = await player.maps.view(explored);

    // Only the revealed tile, served as a tile, never the whole image or its file name.
    await expect(view.tiles).toHaveCount(1);
    expect(await view.tiles.first().getAttribute("href")).toMatch(/\/tiles\/0\/0\?v=/);
    const html = await player.page.content();
    expect(html).not.toContain("Fixture Fog");
    expect(html).not.toMatch(/\/image\?v=/);

    // The area under the fog isn't in the page at all, not even in its data.
    const keep = view.areas.getByRole("button", { name: "Keep" });
    await expect(keep).toBeVisible();
    await expect(player.page.getByRole("list", { name: "Areas" })).toHaveText("Keep");
    expect(html).not.toContain("Cellar");

    await keep.click();
    await expect(player.page.getByText("Nothing more is known yet.")).toBeVisible();
    await expect(player.page.getByRole("button", { name: "Fog" })).toHaveCount(0);
    await expect(player.page.getByRole("link", { name: "Edit map" })).toHaveCount(0);
  });

  test("a player sees the DM's reveals within seconds, without reloading", async ({
    api,
    explored,
    openAs,
  }) => {
    const player = await openAs("playerOne");
    const view = await player.maps.view(explored);
    await expect(view.tiles).toHaveCount(1);
    // Anything set on the page would be lost if it reloaded.
    await view.markStay();

    await api.changeFog(explored, REVEAL_ALL);
    await expect(view.tiles).toHaveCount(2, { timeout: 10_000 });
    await expect(view.areas.getByRole("button", { name: "Cellar" })).toBeVisible();

    await api.changeFog(explored, HIDE_ALL);
    await expect(view.tiles).toHaveCount(0, { timeout: 10_000 });
    await expect(player.page.getByText("Nothing explored here yet.")).toBeVisible();
    await expect(view.areas.getByRole("button")).toHaveCount(0);
    expect(await view.stayed()).toBe(true);

    // No longer shared: the map closes, as if it had never been there.
    await api.share(explored, false);
    await expect(player.page.getByRole("heading", { name: "Map not found" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reveals arrive over the live connection, with no polling at all", async ({
    api,
    explored,
    openAs,
  }) => {
    const player = await openAs("playerOne");
    // Checking the version by hand is refused, so only the live connection can bring changes.
    let polled = 0;
    await player.page.route("**/version", (route) => {
      polled++;
      return route.abort();
    });
    const view = await player.maps.view(explored);
    await view.live();
    await expect(view.tiles).toHaveCount(1);

    await api.changeFog(explored, REVEAL_ALL);
    await expect(view.tiles).toHaveCount(2);
    expect(polled).toBe(0);
  });

  test("checks for changes every few seconds while the live connection is down", async ({
    api,
    explored,
    openAs,
  }) => {
    const player = await openAs("playerOne");
    // Every attempt to connect is turned away, as if a proxy dropped websockets.
    await player.page.routeWebSocket("**/live", (socket) => socket.close());
    const view = await player.maps.view(explored);
    await expect(view.liveStatus).toHaveText("Reconnecting…");
    await expect(view.tiles).toHaveCount(1);

    await api.changeFog(explored, REVEAL_ALL);
    await expect(view.tiles).toHaveCount(2, { timeout: 10_000 });
  });

  test("players can't open the editor", async ({ explored, openAs }) => {
    const player = await openAs("playerOne");
    expect((await player.goto(`${explored.url}/edit`))?.status()).toBe(404);
  });
});
