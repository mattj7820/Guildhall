import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  createMap,
  drawArea,
  expectSaved,
  mapCanvas,
  onImage,
  ORIGIN,
  uniqueName,
} from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Maps for players, with fog of war. Tests start as the DM, who makes and shares maps; Player One
 * gets a second browser. "Fixture Fog.png" is 1024×512, in two 512-pixel tiles, with a magenta
 * square in its bottom-right corner (x 960 to 1023, y 448 to 511): the only magenta in it.
 */

type Change = { type: "paint"; mode: "reveal" | "hide"; shape: object };
const REVEAL_ALL: Change = { type: "paint", mode: "reveal", shape: { kind: "all" } };
/** The bottom-right corner, magenta and all: x from 896, y from 416. */
const HIDE_CORNER: Change = {
  type: "paint",
  mode: "hide",
  shape: {
    kind: "polygon",
    points: [
      [0.875, 0.8125],
      [1, 0.8125],
      [1, 1],
      [0.875, 1],
    ],
  },
};

/** Makes a map of the fog fixture as the DM, and gives its address. */
async function fogMap(page: Page, name = uniqueName("Fog")): Promise<string> {
  await createMap(page, { image: "Fixture Fog.png", name });
  return page.url().replace(/\/edit$/, "");
}

async function share(page: Page, map: string) {
  const response = await page.request.post(`${map}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "setVisibility", visibility: "players" },
  });
  expect(response.status()).toBe(200);
}

async function changeFog(page: Page, map: string, ...changes: Change[]) {
  const response = await page.request.post(`${map}/fog`, {
    headers: { Origin: ORIGIN },
    data: { changes },
  });
  expect(response.status()).toBe(200);
}

async function asPlayerOne(browser: Browser) {
  const context = await browser.newContext({ storageState: SIGNED_IN.playerOne, baseURL: ORIGIN });
  return context.newPage();
}

test("players get only revealed pixels of a shared map, never the whole image", async ({
  page,
  browser,
}) => {
  const map = await fogMap(page);
  await share(page, map);
  await changeFog(page, map, REVEAL_ALL, HIDE_CORNER);

  const player = await asPlayerOne(browser);
  expect((await player.request.get(`${map}/image`)).status()).toBe(404);
  for (const tile of ["0/0", "1/0"]) {
    const response = await player.request.get(`${map}/tiles/${tile}`);
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
  await player.context().close();
});

test("players get no tile the fog hides entirely", async ({ page, browser }) => {
  const map = await fogMap(page);
  await share(page, map);
  await changeFog(page, map, {
    type: "paint",
    mode: "reveal",
    shape: {
      kind: "polygon",
      points: [
        [0, 0],
        [0.4, 0],
        [0.4, 1],
        [0, 1],
      ],
    },
  });

  const player = await asPlayerOne(browser);
  expect((await player.request.get(`${map}/tiles/0/0`)).status()).toBe(200);
  expect((await player.request.get(`${map}/tiles/1/0`)).status()).toBe(404);
  expect((await player.request.get(`${map}/tiles/9/9`)).status()).toBe(404);
  await player.context().close();
});

test("a map that isn't shared gives players nothing at all", async ({ page, browser }) => {
  const map = await fogMap(page);
  await changeFog(page, map, REVEAL_ALL);

  const player = await asPlayerOne(browser);
  expect((await player.request.get(`${map}/image`)).status()).toBe(404);
  expect((await player.request.get(`${map}/tiles/0/0`)).status()).toBe(404);
  const reveal = await player.request.post(`${map}/fog`, {
    headers: { Origin: ORIGIN },
    data: { changes: [REVEAL_ALL] },
  });
  expect(reveal.status()).toBe(404);
  await player.context().close();
});

test.describe("The DM's fog tools", () => {
  const FOG_IMAGE = { width: 1024, height: 512 };
  const fogToolbar = (page: Page) => page.getByRole("toolbar", { name: "Fog of war" });
  const revealed = (page: Page) => fogToolbar(page).getByText(/% revealed$/);
  const fogSaved = (page: Page) =>
    expect(fogToolbar(page).getByRole("status")).toHaveText("✓ Saved");

  /** A map of the fog fixture with one area, "Keep", over its left quarter; opens its page. */
  async function mapWithArea(page: Page) {
    const name = uniqueName("Fog");
    await createMap(page, { image: "Fixture Fog.png", name });
    await drawArea(page, name, FOG_IMAGE, [
      [0.05, 0.1],
      [0.25, 0.1],
      [0.25, 0.9],
      [0.05, 0.9],
    ]);
    await page.getByLabel("Area name").fill("Keep");
    await expectSaved(page);
    await page.getByRole("link", { name: "Done" }).click();
    await expect(mapCanvas(page, name)).toBeVisible();
    return name;
  }

  test("shares a map from the editor, and keeps it shared", async ({ page }) => {
    await createMap(page, { image: "Fixture Fog.png", name: uniqueName("Shared") });
    const share = page.getByRole("switch", { name: "Share with players" });
    await expect(share).toHaveAttribute("aria-checked", "false");
    await share.click();
    await expect(share).toHaveAttribute("aria-checked", "true");
    // It's disabled until the server has saved it.
    await expect(share).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Share with players" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("reveals an area from the list, saves it, and hides it again", async ({ page }) => {
    await mapWithArea(page);
    await page.getByRole("button", { name: "Fog", exact: true }).click();
    const areas = page.getByRole("list", { name: "Areas under the fog" });
    await expect(areas.getByText("Under the fog")).toBeVisible();

    await page.getByRole("button", { name: "Reveal Keep" }).click();
    await expect(areas.getByText("Players see it")).toBeVisible();
    await fogSaved(page);

    await page.reload();
    await page.getByRole("button", { name: "Fog", exact: true }).click();
    await expect(areas.getByText("Players see it")).toBeVisible();
    await page.getByRole("button", { name: "Hide Keep" }).click();
    await expect(areas.getByText("Under the fog")).toBeVisible();
    await fogSaved(page);
  });

  test("brushes the fog away, undoes it, and reveals and hides everything", async ({ page }) => {
    const name = await mapWithArea(page);
    await page.getByRole("button", { name: "Fog", exact: true }).click();
    await expect(revealed(page)).toHaveText("0% revealed");

    const box = (await mapCanvas(page, name).boundingBox())!;
    const at = async (point: [number, number]) => {
      const { x, y } = await onImage(page, name, FOG_IMAGE, point);
      return [box.x + x, box.y + y] as const;
    };
    await page.mouse.move(...(await at([0.3, 0.5])));
    await page.mouse.down();
    await page.mouse.move(...(await at([0.7, 0.5])), { steps: 10 });
    await page.mouse.up();
    await expect(revealed(page)).not.toHaveText("0% revealed");
    await fogSaved(page);

    await page.keyboard.press("Control+z");
    await expect(revealed(page)).toHaveText("0% revealed");
    await fogSaved(page);

    await fogToolbar(page).getByRole("button", { name: "Reveal all" }).click();
    await expect(revealed(page)).toHaveText("100% revealed");
    await fogToolbar(page).getByRole("button", { name: "Hide all" }).click();
    await expect(revealed(page)).toHaveText("0% revealed");
    await fogSaved(page);
    await page.reload();
    await page.getByRole("button", { name: "Fog", exact: true }).click();
    await expect(revealed(page)).toHaveText("0% revealed");
  });

  test("warns when players can see the whole image in the wiki anyway", async ({ page }) => {
    // Mira Stonehand's shared note embeds her portrait.
    await createMap(page, { image: "mira-portrait.png", name: uniqueName("Portrait") });
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("alert")).toContainText("embedded in a wiki note players can read");

    await createMap(page, { image: "Fixture Fog.png", name: uniqueName("Unembedded") });
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Fog", exact: true })).toBeVisible();
    await expect(page.getByText("embedded in a wiki note players can read")).toHaveCount(0);
  });

  test("keeps a secret area secret, however much is revealed", async ({ page }) => {
    await mapWithArea(page);
    await page.getByRole("link", { name: "Edit map" }).click();
    // "Keep" is on the map page too: wait for the editor before choosing it.
    await expect(page).toHaveURL(/\/edit$/);
    await page.getByRole("button", { name: /Keep/ }).first().click();
    await page.getByRole("checkbox", { name: /Secret/ }).check();
    await expectSaved(page);
    await page.getByRole("link", { name: "Done" }).click();

    await page.getByRole("button", { name: "Fog", exact: true }).click();
    await fogToolbar(page).getByRole("button", { name: "Reveal all" }).click();
    await expect(
      page.getByRole("list", { name: "Areas under the fog" }).getByText("Secret"),
    ).toBeVisible();
  });
});

test.describe("Maps for players", () => {
  const FOG_IMAGE = { width: 1024, height: 512 };
  const LEFT_THIRD: Change = {
    type: "paint",
    mode: "reveal",
    shape: {
      kind: "polygon",
      points: [
        [0, 0],
        [0.3, 0],
        [0.3, 1],
        [0, 1],
      ],
    },
  };

  /**
   * A shared map of the fog fixture with "Keep" in its left quarter, revealed, and "Cellar" on
   * its right, still under the fog. Gives the map's name and address.
   */
  async function sharedMap(page: Page) {
    const name = uniqueName("Explored");
    await createMap(page, { image: "Fixture Fog.png", name });
    const map = page.url().replace(/\/edit$/, "");
    for (const [area, corners] of [
      [
        "Keep",
        [
          [0.05, 0.1],
          [0.25, 0.1],
          [0.25, 0.9],
          [0.05, 0.9],
        ],
      ],
      [
        "Cellar",
        [
          [0.6, 0.2],
          [0.9, 0.2],
          [0.9, 0.8],
          [0.6, 0.8],
        ],
      ],
    ] as const) {
      await drawArea(
        page,
        name,
        FOG_IMAGE,
        corners.map(([x, y]) => [x, y]),
      );
      await page.getByLabel("Area name").fill(area);
      await expectSaved(page);
    }
    await share(page, map);
    await changeFog(page, map, LEFT_THIRD);
    return { name, map };
  }

  test("players find shared maps from the hub and the menu", async ({ page, browser }) => {
    const { name } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    await player.goto("/");
    await expect(player.getByRole("link", { name: /^Maps/ }).first()).toBeVisible();
    await player
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Maps" })
      .click();
    await player.getByRole("link", { name }).click();
    await expect(player.getByRole("navigation", { name: "Breadcrumbs" })).toContainText(name);
    await player.context().close();
  });

  test("a player sees only what's revealed, and only the areas they can see", async ({
    page,
    browser,
  }) => {
    const { map } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    await player.goto(map);

    // Only the revealed tile, served as a tile, never the whole image or its file name.
    const tiles = player.locator('svg image[href*="/tiles/"]');
    await expect(tiles).toHaveCount(1);
    expect(await tiles.first().getAttribute("href")).toMatch(/\/tiles\/0\/0\?v=/);
    const html = await player.content();
    expect(html).not.toContain("Fixture Fog");
    expect(html).not.toMatch(/\/image\?v=/);

    // The area under the fog isn't in the page at all, not even in its data.
    const keep = player
      .getByRole("group", { name: "Map areas" })
      .getByRole("button", { name: "Keep" });
    await expect(keep).toBeVisible();
    await expect(player.getByRole("list", { name: "Areas" })).toHaveText("Keep");
    expect(html).not.toContain("Cellar");

    await keep.click();
    await expect(player.getByText("Nothing more is known yet.")).toBeVisible();
    await expect(player.getByRole("button", { name: "Fog" })).toHaveCount(0);
    await expect(player.getByRole("link", { name: "Edit map" })).toHaveCount(0);
    await player.context().close();
  });

  test("a player sees the DM's reveals within seconds, without reloading", async ({
    page,
    browser,
  }) => {
    const { map } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    await player.goto(map);
    const tiles = player.locator('svg image[href*="/tiles/"]');
    await expect(tiles).toHaveCount(1);
    // Anything set on the page would be lost if it reloaded.
    await player.evaluate(() => ((window as { stayed?: boolean }).stayed = true));

    await changeFog(page, map, REVEAL_ALL);
    await expect(tiles).toHaveCount(2, { timeout: 10_000 });
    const areas = player.getByRole("group", { name: "Map areas" });
    await expect(areas.getByRole("button", { name: "Cellar" })).toBeVisible();

    await changeFog(page, map, { type: "paint", mode: "hide", shape: { kind: "all" } });
    await expect(tiles).toHaveCount(0, { timeout: 10_000 });
    await expect(player.getByText("Nothing explored here yet.")).toBeVisible();
    await expect(areas.getByRole("button")).toHaveCount(0);
    expect(await player.evaluate(() => (window as { stayed?: boolean }).stayed)).toBe(true);

    // No longer shared: the map closes, as if it had never been there.
    const unshare = await page.request.post(`${map}/edit`, {
      headers: { Origin: ORIGIN },
      data: { intent: "setVisibility", visibility: "dm" },
    });
    expect(unshare.status()).toBe(200);
    await expect(player.getByRole("heading", { name: "Map not found" })).toBeVisible({
      timeout: 10_000,
    });
    await player.context().close();
  });

  test("reveals arrive over the live connection, with no polling at all", async ({
    page,
    browser,
  }) => {
    const { map } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    // Checking the version by hand is refused, so only the live connection can bring changes.
    let polled = 0;
    await player.route("**/version", (route) => {
      polled++;
      return route.abort();
    });
    await player.goto(map);
    await expect(player.getByRole("status", { name: "Live updates" })).toHaveText("Live");
    const tiles = player.locator('svg image[href*="/tiles/"]');
    await expect(tiles).toHaveCount(1);

    await changeFog(page, map, REVEAL_ALL);
    await expect(tiles).toHaveCount(2);
    expect(polled).toBe(0);
    await player.context().close();
  });

  test("checks for changes every few seconds while the live connection is down", async ({
    page,
    browser,
  }) => {
    const { map } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    // Every attempt to connect is turned away, as if a proxy dropped websockets.
    await player.routeWebSocket("**/live", (socket) => socket.close());
    await player.goto(map);
    await expect(player.getByRole("status", { name: "Live updates" })).toHaveText("Reconnecting…");
    const tiles = player.locator('svg image[href*="/tiles/"]');
    await expect(tiles).toHaveCount(1);

    await changeFog(page, map, REVEAL_ALL);
    await expect(tiles).toHaveCount(2, { timeout: 10_000 });
    await player.context().close();
  });

  test("players can't open the editor", async ({ page, browser }) => {
    const { map } = await sharedMap(page);
    const player = await asPlayerOne(browser);
    expect((await player.goto(`${map}/edit`))?.status()).toBe(404);
    await player.context().close();
  });
});
