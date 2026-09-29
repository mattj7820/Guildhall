import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { createMap, ORIGIN, uniqueName } from "./support/app";
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
