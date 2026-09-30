import { expect, test, type Browser, type Page } from "@playwright/test";
import { createMap, mapCanvas, onImage, ORIGIN, uniqueName } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Tokens on maps. Tests start as the DM, who makes a shared map of the fog fixture (1024×512)
 * with its left third revealed; Player One (who plays Fixture PC One) gets a second browser.
 *
 * Each party member is in one place, on one map, and every spec shares the server's party, so
 * these tests run in order, and no other spec places party members.
 */
test.describe.configure({ mode: "serial" });

const FOG_IMAGE = { width: 1024, height: 512 };
const LIT: [number, number] = [0.15, 0.5];
const LIT_TOO: [number, number] = [0.2, 0.3];
const DARK: [number, number] = [0.7, 0.5];

async function sharedMap(page: Page) {
  const name = uniqueName("Tokens");
  await createMap(page, { image: "Fixture Fog.png", name });
  const map = page.url().replace(/\/edit$/, "");
  const post = (path: string, data: object) =>
    page.request.post(`${map}/${path}`, { headers: { Origin: ORIGIN }, data });
  expect((await post("edit", { intent: "setVisibility", visibility: "players" })).status()).toBe(
    200,
  );
  const leftThird = [
    [0, 0],
    [0.3, 0],
    [0.3, 1],
    [0, 1],
  ];
  const reveal = { type: "paint", mode: "reveal", shape: { kind: "polygon", points: leftThird } };
  expect((await post("fog", { changes: [reveal] })).status()).toBe(200);
  await page.goto(map);
  return { name, map };
}

async function asPlayerOne(browser: Browser) {
  const context = await browser.newContext({ storageState: SIGNED_IN.playerOne, baseURL: ORIGIN });
  return context.newPage();
}

const tokens = (page: Page) => page.getByRole("group", { name: "Tokens" });
const anyToken = (page: Page) => tokens(page).getByRole("img").or(tokens(page).getByRole("button"));
const tokenNamed = (page: Page, name: string) =>
  tokens(page).getByRole("button", { name: new RegExp(`^${name} at`) });

/** Where a token is, from its label: "Fixture PC One at 15.0%, 50.0%, …". */
async function whereIs(page: Page, name: string): Promise<[number, number]> {
  const label = (await tokenNamed(page, name).getAttribute("aria-label")) ?? "";
  const [, x, y] = /at ([\d.]+)%, ([\d.]+)%/.exec(label) ?? [];
  return [Number(x) / 100, Number(y) / 100];
}

/** Where a token is, whether the viewer may move it just now or not. */
async function whereIsAny(page: Page, name: string): Promise<[number, number]> {
  const token = tokens(page).locator(`[aria-label^="${name} at"]`).first();
  const [, x, y] =
    /at ([\d.]+)%, ([\d.]+)%/.exec((await token.getAttribute("aria-label")) ?? "") ?? [];
  return [Number(x) / 100, Number(y) / 100];
}

/** Where a token is on screen once it has finished gliding to where someone else put it. */
async function restingBox(page: Page, name: string) {
  let last = "";
  for (;;) {
    const box = await tokenNamed(page, name).boundingBox();
    if (!box) throw new Error(`${name} isn't on screen`);
    if (JSON.stringify(box) === last) return box;
    last = JSON.stringify(box);
    await page.waitForTimeout(100);
  }
}

/** Drags a token by the mouse to a point on the image, in several steps like a hand would. */
async function dragToken(page: Page, mapName: string, name: string, to: [number, number]) {
  const box = await restingBox(page, name);
  const canvas = await mapCanvas(page, mapName).boundingBox();
  const target = await onImage(page, mapName, FOG_IMAGE, to);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + target.x, canvas!.y + target.y, { steps: 10 });
  await page.mouse.up();
}

/** Close enough: a drop lands to the nearest pixel. */
const near = ([x, y]: [number, number], [tx, ty]: [number, number]) =>
  Math.abs(x - tx) < 0.02 && Math.abs(y - ty) < 0.02;

async function clickMap(page: Page, name: string, at: [number, number]) {
  await mapCanvas(page, name).click({ position: await onImage(page, name, FOG_IMAGE, at) });
}

/** Places a party member (by the name on their card) where the DM clicks. */
async function placeMember(page: Page, mapName: string, member: string, at: [number, number]) {
  await page
    .getByRole("list", { name: "Party" })
    .getByRole("button", { name: new RegExp(`^(Place|Bring) ${member} here$`) })
    .click();
  await clickMap(page, mapName, at);
  await expect(
    tokens(page).getByRole("button", { name: new RegExp(`^${member} at`) }),
  ).toBeVisible();
}

async function addMarker(
  page: Page,
  mapName: string,
  { name, shown, at }: { name: string; shown: boolean; at: [number, number] },
) {
  await page.getByRole("button", { name: "Add marker" }).click();
  const form = page.getByRole("form", { name: "New marker" });
  await form.getByLabel("Marker name").fill(name);
  await form.getByRole("radio", { name: "teal" }).check();
  if (shown) await form.getByLabel(/Players can see it/).check();
  await form.getByRole("button", { name: "Place on the map" }).click();
  await clickMap(page, mapName, at);
  await expect(tokens(page).getByRole("button", { name: new RegExp(`^${name} at`) })).toBeVisible();
}

test("the DM places the party and markers, and a player gets only what they may see", async ({
  page,
  browser,
}) => {
  const { name, map } = await sharedMap(page);
  const secret = uniqueName("Secret marker");
  const shownInTheDark = uniqueName("Shown in the dark");
  const shown = uniqueName("Shown marker");

  await placeMember(page, name, "Fixture PC One", LIT);
  await placeMember(page, name, "Fixture PC Two", DARK);
  await addMarker(page, name, { name: secret, shown: false, at: LIT_TOO });
  await addMarker(page, name, { name: shownInTheDark, shown: true, at: DARK });
  await addMarker(page, name, { name: shown, shown: true, at: LIT_TOO });

  // The DM sees everything, with what players can't see of it.
  await expect(
    tokens(page).getByRole("button", { name: /^Fixture PC Two at .*under the fog/ }),
  ).toBeVisible();
  await expect(
    tokens(page).getByRole("button", {
      name: new RegExp(`^${secret} at .*players can't see this`),
    }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Party" })).toContainText("Fixture PC One here");

  // Tokens are kept: they're still there after reloading.
  await page.reload();
  await expect(tokens(page).getByRole("button")).toHaveCount(5);

  const player = await asPlayerOne(browser);
  await player.goto(map);
  // Their own PC is theirs to move; the marker is only a picture.
  await expect(
    tokens(player).getByRole("button", { name: /^Fixture PC One at .*you can move this$/ }),
  ).toBeVisible();
  await expect(tokens(player).getByRole("img", { name: new RegExp(`^${shown} at`) })).toBeVisible();
  await expect(anyToken(player)).toHaveCount(2);

  // Not hidden in the browser: absent from the page and its data altogether.
  const html = await player.content();
  const data = await (await player.request.get(`${map}.data`)).text();
  for (const text of [html, data]) {
    expect(text).not.toContain(secret);
    expect(text).not.toContain(shownInTheDark);
    expect(text).not.toContain("Fixture PC Two");
    expect(text).not.toContain("Party/");
  }
  await player.context().close();
});

test("a player sees their own token even under the fog, in the dark", async ({ page, browser }) => {
  const { name, map } = await sharedMap(page);
  await placeMember(page, name, "Fixture PC One", DARK);
  await placeMember(page, name, "Fixture Companion", DARK);

  const player = await asPlayerOne(browser);
  await player.goto(map);
  await expect(
    tokens(player).getByRole("button", { name: /^Fixture PC One at .*in the dark/ }),
  ).toBeVisible();
  await expect(
    tokens(player).getByRole("button", { name: /^Fixture Companion at .*in the dark/ }),
  ).toBeVisible();
  await player.context().close();
});

test("the DM brings a party member from another map, and takes tokens away", async ({ page }) => {
  const first = await sharedMap(page);
  await placeMember(page, first.name, "Fixture PC One", LIT);
  const second = await sharedMap(page);
  const party = page.getByRole("list", { name: "Party" });
  await expect(party).toContainText(`Fixture PC One on ${first.name}`);

  await placeMember(page, second.name, "Fixture PC One", LIT_TOO);
  await page.goto(first.map);
  await expect(tokens(page).getByRole("button", { name: /^Fixture PC One/ })).toHaveCount(0);
  await expect(party).toContainText(`Fixture PC One on ${second.name}`);

  await page.goto(second.map);
  await tokens(page)
    .getByRole("button", { name: /^Fixture PC One at/ })
    .click();
  await page.getByRole("button", { name: "Take off this map" }).click();
  await expect(tokens(page).getByRole("button")).toHaveCount(0);
  await expect(party).toContainText("Fixture PC One not placed");
});

test("a player can't place, change or move tokens that aren't theirs", async ({
  page,
  browser,
}) => {
  const { name, map } = await sharedMap(page);
  await placeMember(page, name, "Fixture PC Two", LIT);
  const marker = uniqueName("Marker");
  await addMarker(page, name, { name: marker, shown: true, at: LIT_TOO });

  const player = await asPlayerOne(browser);
  await player.goto(map);
  // Nothing to change: tokens are pictures for them, and there's no panel.
  await expect(tokens(player).getByRole("button")).toHaveCount(0);
  await expect(player.getByRole("button", { name: "Add marker" })).toHaveCount(0);

  // A change that can't be made still answers with the map's tokens: here, to learn their IDs.
  const dmTokens = await (
    await page.request.post(`${map}/tokens`, {
      headers: { Origin: ORIGIN },
      data: { actions: [{ type: "move", id: "none", to: [0.1, 0.1] }] },
    })
  ).json();
  const idOf = (label: string) =>
    (dmTokens.tokens as { id: string; name: string }[]).find((token) => token.name === label)!.id;

  const attempt = (actions: object[]) =>
    player.request.post(`${map}/tokens`, { headers: { Origin: ORIGIN }, data: { actions } });
  for (const actions of [
    [{ type: "move", id: idOf("Fixture PC Two"), to: [0.1, 0.1] }],
    [{ type: "move", id: idOf(marker), to: [0.1, 0.1] }],
    [{ type: "remove", id: idOf(marker) }],
    [{ type: "editMarker", id: idOf(marker), name: "Mine now" }],
    [
      {
        type: "place",
        token: {
          kind: "marker",
          id: "p",
          map: map.split("/").pop(),
          at: [0.1, 0.1],
          name: "Mine",
          colour: "red",
          visibility: "players",
        },
      },
    ],
  ]) {
    expect((await attempt(actions)).status()).toBe(403);
  }
  // Nothing changed: the same two tokens, and the marker kept its name.
  await page.reload();
  await expect(tokens(page).getByRole("button")).toHaveCount(2);
  await expect(
    tokens(page).getByRole("button", { name: new RegExp(`^${marker} at`) }),
  ).toBeVisible();
  await player.context().close();
});

test("a player drags their token and the DM sees it move, and the other way round", async ({
  page,
  browser,
}) => {
  const { name, map } = await sharedMap(page);
  await placeMember(page, name, "Fixture PC One", LIT);
  const player = await asPlayerOne(browser);
  await player.goto(map);
  // Anything set on a page would be lost if it reloaded.
  for (const each of [page, player]) {
    await each.evaluate(() => ((window as { stayed?: boolean }).stayed = true));
  }

  const there: [number, number] = [0.25, 0.2];
  await dragToken(player, name, "Fixture PC One", there);
  await expect.poll(() => whereIs(page, "Fixture PC One").then((at) => near(at, there))).toBe(true);

  const back: [number, number] = [0.1, 0.8];
  await dragToken(page, name, "Fixture PC One", back);
  await expect
    .poll(() => whereIs(player, "Fixture PC One").then((at) => near(at, back)))
    .toBe(true);

  // Kept: both see it there after reloading, too.
  await player.reload();
  expect(near(await whereIs(player, "Fixture PC One"), back)).toBe(true);
  expect(await page.evaluate(() => (window as { stayed?: boolean }).stayed)).toBe(true);
  await player.context().close();
});

test("others see a token move while it's dragged, and can't pick it up meanwhile", async ({
  page,
  browser,
}) => {
  const { name, map } = await sharedMap(page);
  await placeMember(page, name, "Fixture Companion", LIT);
  const player = await asPlayerOne(browser);
  await player.goto(map);
  await expect(player.getByRole("status", { name: "Live updates" })).toHaveText("Live");

  // The DM picks the companion up and holds it partway, without letting go.
  const box = await restingBox(page, "Fixture Companion");
  const canvas = await mapCanvas(page, name).boundingBox();
  const partway = await onImage(page, name, FOG_IMAGE, [0.25, 0.25]);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + partway.x, canvas!.y + partway.y, { steps: 10 });

  // The player sees it there already, as the DM's to move just now.
  const held = tokens(player).getByRole("img", {
    name: /^Fixture Companion at .*Dev DM is moving it/,
  });
  await expect(held).toBeVisible();
  await expect
    .poll(async () => near(await whereIsAny(player, "Fixture Companion"), [0.25, 0.25]))
    .toBe(true);

  // And once it's let go, it's theirs to move again, where the DM left it.
  await page.mouse.up();
  await expect(tokenNamed(player, "Fixture Companion")).toBeVisible();
  expect(near(await whereIs(player, "Fixture Companion"), [0.25, 0.25])).toBe(true);
  await player.context().close();
});

test("a player moves their token with the arrow keys", async ({ page, browser }) => {
  const { name, map } = await sharedMap(page);
  await placeMember(page, name, "Fixture PC One", LIT);
  const player = await asPlayerOne(browser);
  await player.goto(map);
  const [x, y] = await whereIs(player, "Fixture PC One");

  await tokenNamed(player, "Fixture PC One").focus();
  await player.keyboard.press("ArrowRight");
  await player.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(() => whereIs(page, "Fixture PC One").then(([nx, ny]) => nx > x && ny > y))
    .toBe(true);
  await player.context().close();
});

test("the DM brings everyone into a deeper map, and players find where they are", async ({
  page,
  browser,
}) => {
  const outer = await sharedMap(page);
  const inner = await sharedMap(page);
  // An area in the outer map's revealed left third that leads to the inner map.
  const town = {
    id: "town",
    name: "Fixture town",
    outline: [
      [0.05, 0.1],
      [0.25, 0.1],
      [0.25, 0.9],
      [0.05, 0.9],
    ],
    map: inner.map.split("/").pop(),
    visibility: "players",
  };
  const saved = await page.request.post(`${outer.map}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "save", name: outer.name, areas: [town] },
  });
  expect(saved.status()).toBe(200);

  await page.goto(inner.map);
  await page.getByRole("button", { name: "Bring everyone here" }).click();
  await clickMap(page, inner.name, [0.15, 0.5]);
  await expect(anyToken(page)).toHaveCount(3);

  const player = await asPlayerOne(browser);
  // The outer map shows who's inside the area that leads in.
  await player.goto(outer.map);
  await expect(
    player.getByRole("img", {
      name: "Inside Fixture town: Fixture PC One, Fixture PC Two, Fixture Companion",
    }),
  ).toBeVisible();

  // The Maps page says where they are, and takes them there.
  await player.goto("/maps");
  const where = player.getByRole("region", { name: "Where you are" });
  await expect(where).toContainText(`Fixture PC One is on ${inner.name}`);
  await where.getByRole("link", { name: inner.name }).first().click();

  // Find centres the map on their token, zoomed in.
  await player
    .getByRole("list", { name: "Party here" })
    .getByRole("button", { name: "Find Fixture PC One" })
    .click();
  await expect(player.getByRole("status", { name: "Zoom level" })).not.toHaveText("100%");
  await player.context().close();
});

test("on a battle map, tokens fill their squares and snap to them, unless the DM turns it off", async ({
  page,
  browser,
}) => {
  const { name, map } = await sharedMap(page);
  // 64-pixel squares: 16 × 8 over the 1024×512 fixture.
  const grid = { square: 0.0625, origin: [0, 0], lines: 0.4 };
  const saved = await page.request.post(`${map}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "save", name, areas: [], grid },
  });
  expect(saved.status()).toBe(200);
  await page.reload();
  await placeMember(page, name, "Fixture PC One", LIT);
  const player = await asPlayerOne(browser);
  await player.goto(map);

  // Dropped near the square in column 2, row 3, it settles in its middle: 160, 224 pixels.
  await dragToken(player, name, "Fixture PC One", [0.147, 0.41]);
  const centre = /^Fixture PC One at 15\.6%, 43\.8%/;
  await expect(tokens(player).getByRole("button", { name: centre })).toBeVisible();
  await expect(tokens(page).getByRole("button", { name: centre })).toBeVisible();

  // A Large token fills four squares: twice as wide.
  const ring = () => tokenNamed(player, "Fixture PC One").locator("circle").first().boundingBox();
  const medium = (await ring())!.width;
  await tokenNamed(page, "Fixture PC One").click();
  await page.getByLabel("Size").selectOption({ label: "Large (2 × 2 squares)" });
  await expect.poll(async () => (await ring())!.width / medium).toBeGreaterThan(1.8);

  // Snapping off: tokens go exactly where they're put.
  await page.getByRole("switch", { name: "Snap to grid" }).click();
  await expect(page.getByRole("switch", { name: "Snap to grid" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await player.reload();
  await dragToken(player, name, "Fixture PC One", [0.147, 0.41]);
  await expect
    .poll(() =>
      whereIs(page, "Fixture PC One").then((at) => near(at, [0.147, 0.41]) && at[0] !== 0.156),
    )
    .toBe(true);
  await player.context().close();
});

test("a map that isn't shared takes no token changes from players", async ({ page, browser }) => {
  const name = uniqueName("Unshared");
  await createMap(page, { image: "Fixture Fog.png", name });
  const map = page.url().replace(/\/edit$/, "");
  const player = await asPlayerOne(browser);
  const response = await player.request.post(`${map}/tokens`, {
    headers: { Origin: ORIGIN },
    data: { actions: [{ type: "move", id: "anything", to: [0.1, 0.1] }] },
  });
  expect(response.status()).toBe(404);
  await player.context().close();
});
