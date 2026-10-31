import { expect, test as base } from "./support/fixtures";
import { near } from "./pages/maps";
import type { Api } from "./support/api";
import {
  fogRect,
  rectangle,
  SQUARES_64,
  uniqueName,
  type MapRef,
  type Point,
} from "./support/test-data";

/**
 * Tokens on maps. Tests start as the DM, with a shared map of the fog fixture (1024×512) with its
 * left third revealed; Player One (who plays Fixture PC One) gets a second browser.
 *
 * Each party member is in one place, on one map, and every spec shares the server's party, so
 * these tests run in order, and no other spec places party members.
 */
const LIT: Point = [0.15, 0.5];
const LIT_TOO: Point = [0.2, 0.3];
const DARK: Point = [0.7, 0.5];

const test = base.extend<{ lit: MapRef }>({
  /** A shared map of the fog fixture, its left third revealed. */
  lit: async ({ api }, use) => {
    await use(await sharedMap(api));
  },
});

test.describe.configure({ mode: "serial" });

function sharedMap(api: Api) {
  return api.createMap({
    name: uniqueName("Tokens"),
    shared: true,
    fog: [fogRect("reveal", [0, 0], [0.3, 1])],
  });
}

test("the DM places the party and markers, and a player gets only what they may see", async ({
  lit,
  maps,
  openAs,
}) => {
  const view = await maps.view(lit);
  const secret = uniqueName("Secret marker");
  const shownInTheDark = uniqueName("Shown in the dark");
  const shown = uniqueName("Shown marker");

  await view.placeMember("Fixture PC One", LIT);
  await view.placeMember("Fixture PC Two", DARK);
  await view.addToken({ name: secret, shown: false, at: LIT_TOO });
  await view.addToken({ name: shownInTheDark, shown: true, at: DARK });
  await view.addToken({ name: shown, shown: true, at: LIT_TOO });

  // The DM sees everything, with what players can't see of it.
  await expect(
    view.tokenGroup.getByRole("button", { name: /^Fixture PC Two at .*under the fog/ }),
  ).toBeVisible();
  await expect(
    view.tokenGroup.getByRole("button", {
      name: new RegExp(`^${secret} at .*players can't see this`),
    }),
  ).toBeVisible();
  await expect(view.party).toContainText("Fixture PC One here");

  // Tokens are kept: they're still there after reloading.
  await view.reload();
  await expect(view.tokenGroup.getByRole("button")).toHaveCount(5);

  const player = await openAs("playerOne");
  const theirs = await player.maps.view(lit);
  // Their own PC is theirs to move; the marker is only a picture.
  await expect(
    theirs.tokenGroup.getByRole("button", { name: /^Fixture PC One at .*you can move this$/ }),
  ).toBeVisible();
  await expect(
    theirs.tokenGroup.getByRole("img", { name: new RegExp(`^${shown} at`) }),
  ).toBeVisible();
  await expect(theirs.anyToken).toHaveCount(2);

  // Not hidden in the browser: absent from the page and its data altogether.
  const html = await player.page.content();
  const data = await (await player.api.request.get(`${lit.url}.data`)).text();
  for (const text of [html, data]) {
    expect(text).not.toContain(secret);
    expect(text).not.toContain(shownInTheDark);
    expect(text).not.toContain("Fixture PC Two");
    expect(text).not.toContain("Party/");
  }
});

test("the front page shows where the party is, with only the faces each viewer may see", async ({
  app,
  openAs,
  page,
}) => {
  // Placed by the test before: PC One in the light and PC Two in the dark, on the newest map.
  await app.goto("/");
  const party = page.getByRole("list", { name: "The party here" });
  await expect(page.getByRole("region", { name: "The campaign now" })).toContainText(
    /The party is at Tokens/,
  );
  await expect(party.getByRole("img", { name: "Fixture PC Two" })).toBeVisible();

  const player = await openAs("playerOne");
  await player.goto("/");
  const theirs = player.page.getByRole("list", { name: "The party here" });
  await expect(theirs.getByRole("img", { name: "Fixture PC One" })).toBeVisible();
  await expect(theirs.getByRole("img")).toHaveCount(1);
  await player.page.getByRole("link", { name: /^Open Tokens/ }).click();
  await expect(player.page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText(
    "Tokens",
  );
});

test("a player sees their own token even under the fog, in the dark", async ({
  lit,
  maps,
  openAs,
}) => {
  const view = await maps.view(lit);
  await view.placeMember("Fixture PC One", DARK);
  await view.placeMember("Fixture Companion", DARK);

  const theirs = await (await openAs("playerOne")).maps.view(lit);
  await expect(
    theirs.tokenGroup.getByRole("button", { name: /^Fixture PC One at .*in the dark/ }),
  ).toBeVisible();
  await expect(
    theirs.tokenGroup.getByRole("button", { name: /^Fixture Companion at .*in the dark/ }),
  ).toBeVisible();
});

test("the DM brings a party member from another map, and takes tokens away", async ({
  api,
  lit: first,
  maps,
  page,
}) => {
  await (await maps.view(first)).placeMember("Fixture PC One", LIT);
  const second = await sharedMap(api);
  const view = await maps.view(second);
  await view.openTokens();
  await expect(view.party).toContainText(`Fixture PC One on ${first.name}`);

  await view.placeMember("Fixture PC One", LIT_TOO);
  const firstView = await maps.view(first);
  await firstView.openTokens();
  await expect(firstView.tokenGroup.getByRole("button", { name: /^Fixture PC One/ })).toHaveCount(
    0,
  );
  await expect(firstView.party).toContainText(`Fixture PC One on ${second.name}`);

  await maps.view(second);
  await view.token("Fixture PC One").click();
  await page.getByRole("button", { name: "Take off this map" }).click();
  await expect(view.tokenGroup.getByRole("button")).toHaveCount(0);
  await expect(view.party).toContainText("Fixture PC One not placed");
});

test("a player can't place, change or move tokens that aren't theirs", async ({
  api,
  lit,
  maps,
  openAs,
}) => {
  const view = await maps.view(lit);
  await view.placeMember("Fixture PC Two", LIT);
  const marker = uniqueName("Marker");
  await view.addToken({ name: marker, shown: true, at: LIT_TOO });

  const player = await openAs("playerOne");
  const theirs = await player.maps.view(lit);
  // Nothing to change: tokens are pictures for them, and there's no panel.
  await expect(theirs.tokenGroup.getByRole("button")).toHaveCount(0);
  await expect(player.page.getByRole("tab", { name: "Tokens" })).toHaveCount(0);

  const tokens = await api.tokens(lit);
  const idOf = (name: string) => tokens.find((token) => token.name === name)!.id;
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
          map: lit.id,
          at: [0.1, 0.1],
          name: "Mine",
          colour: "red",
          visibility: "players",
        },
      },
    ],
  ]) {
    expect((await player.api.tokensRequest(lit, actions)).status()).toBe(403);
  }
  // Nothing changed: the same two tokens, and the marker kept its name.
  await view.reload();
  await expect(view.tokenGroup.getByRole("button")).toHaveCount(2);
  await expect(view.token(marker)).toBeVisible();
});

test("a player drags their token and the DM sees it move, and the other way round", async ({
  lit,
  maps,
  openAs,
}) => {
  const view = await maps.view(lit);
  await view.placeMember("Fixture PC One", LIT);
  const theirs = await (await openAs("playerOne")).maps.view(lit);
  await theirs.live();
  // Anything set on a page would be lost if it reloaded.
  await view.markStay();

  const there: Point = [0.25, 0.2];
  await theirs.dragToken("Fixture PC One", there);
  await view.expectTokenNear("Fixture PC One", there);

  const back: Point = [0.1, 0.8];
  await view.dragToken("Fixture PC One", back);
  await theirs.expectTokenNear("Fixture PC One", back);

  // Kept: both see it there after reloading, too.
  await theirs.reload();
  expect(near(await theirs.whereIs("Fixture PC One"), back)).toBe(true);
  expect(await view.stayed()).toBe(true);
});

test("others see a token move while it's dragged, and can't pick it up meanwhile", async ({
  lit,
  maps,
  openAs,
  page,
}) => {
  const view = await maps.view(lit);
  await view.placeMember("Fixture Companion", LIT);
  const theirs = await (await openAs("playerOne")).maps.view(lit);
  await theirs.live();

  // The DM picks the companion up and holds it partway, without letting go.
  await view.holdToken("Fixture Companion", [0.25, 0.25]);

  // The player sees it there already, as the DM's to move just now.
  const held = theirs.tokenGroup.getByRole("img", {
    name: /^Fixture Companion at .*Dev DM is moving it/,
  });
  await expect(held).toBeVisible();
  await theirs.expectTokenNear("Fixture Companion", [0.25, 0.25]);

  // And once it's let go, it's theirs to move again, where the DM left it.
  await page.mouse.up();
  await expect(theirs.token("Fixture Companion")).toBeVisible();
  await theirs.expectTokenNear("Fixture Companion", [0.25, 0.25]);
});

test("a player moves their token with the arrow keys", async ({ lit, maps, openAs }) => {
  const view = await maps.view(lit);
  await view.placeMember("Fixture PC One", LIT);
  const player = await openAs("playerOne");
  const theirs = await player.maps.view(lit);
  const [x, y] = await theirs.whereIs("Fixture PC One");

  await theirs.token("Fixture PC One").focus();
  await player.page.keyboard.press("ArrowRight");
  await player.page.keyboard.press("Shift+ArrowDown");
  await expect
    .poll(() => view.whereIs("Fixture PC One").then(([nx, ny]) => nx > x && ny > y))
    .toBe(true);
});

test("the DM brings everyone into a deeper map, and players find where they are", async ({
  api,
  lit: outer,
  maps,
  openAs,
  page,
}) => {
  const inner = await sharedMap(api);
  // An area in the outer map's revealed left third that leads to the inner map.
  const town = {
    id: "town",
    name: "Fixture town",
    outline: rectangle([0.05, 0.1], [0.25, 0.9]),
    map: inner.id,
    visibility: "players",
  };
  await api.saveMap(outer, { areas: [town] });

  const view = await maps.view(inner);
  await view.openTokens();
  await page.getByRole("button", { name: "Bring everyone here" }).click();
  await view.click([0.15, 0.5]);
  await expect(view.anyToken).toHaveCount(3);

  const player = await openAs("playerOne");
  // The outer map shows who's inside the area that leads in.
  await player.maps.view(outer);
  await expect(
    player.page.getByRole("img", {
      name: "Inside Fixture town: Fixture PC One, Fixture PC Two, Fixture Companion",
    }),
  ).toBeVisible();

  // The Maps page says where they are, and takes them there.
  await player.maps.open();
  const where = player.page.getByRole("region", { name: "Where you are" });
  await expect(where).toContainText(`Fixture PC One is on ${inner.name}`);
  await where.getByRole("link", { name: inner.name }).first().click();

  // Find centres the map on their token, zoomed in.
  await player.page
    .getByRole("list", { name: "Party here" })
    .getByRole("button", { name: "Find Fixture PC One" })
    .click();
  await expect(player.page.getByRole("status", { name: "Zoom level" })).not.toHaveText("100%");
});

test("a player takes their token into a revealed deeper map, and back up", async ({
  api,
  lit: outer,
  maps,
  openAs,
}) => {
  const inner = await sharedMap(api);
  const behindSecret = await sharedMap(api);
  const hidden = await api.createMap({ name: uniqueName("Hidden") });
  const area = (id: string, name: string, map: string, visibility: string, x: number) => ({
    id,
    name,
    outline: rectangle([x, 0.1], [x + 0.08, 0.9]),
    map,
    visibility,
  });
  // In the revealed left third: a way in, a secret way in, and a way to a map that isn't shared.
  await api.saveMap(outer, {
    areas: [
      area("gate", "Fixture gate", inner.id, "players", 0.02),
      area("secret", "Fixture secret door", behindSecret.id, "dm", 0.11),
      area("closed", "Fixture closed door", hidden.id, "players", 0.2),
    ],
  });
  const view = await maps.view(outer);
  await view.placeMember("Fixture PC One", LIT);

  const player = await openAs("playerOne");
  const theirs = await player.maps.view(outer);
  await expect(player.page.getByRole("button", { name: /Take Fixture PC One/ })).toHaveCount(1);
  await theirs.travel("Fixture PC One", "into Fixture gate");
  await expect(player.page).toHaveURL(new RegExp(`${inner.url}$`));
  await expect(theirs.token("Fixture PC One")).toBeVisible();
  // The DM sees them go.
  await expect(view.token("Fixture PC One")).toBeHidden();

  await theirs.travel("Fixture PC One", `back to ${outer.name}`);
  await expect(player.page).toHaveURL(new RegExp(`${outer.url}$`));
  await theirs.expectTokenNear("Fixture PC One", [0.06, 0.5]);
  await expect(view.token("Fixture PC One")).toBeVisible();
});

test("on a battle map, tokens fill their squares and snap to them, unless the DM turns it off", async ({
  api,
  lit,
  maps,
  openAs,
  page,
}) => {
  await api.saveMap(lit, { grid: SQUARES_64 });
  const view = await maps.view(lit);
  await view.placeMember("Fixture PC One", LIT);
  const player = await openAs("playerOne");
  const theirs = await player.maps.view(lit);
  await theirs.live();

  // Dropped near the square in column 2, row 3, it settles in its middle: 160, 224 pixels.
  await theirs.dragToken("Fixture PC One", [0.147, 0.41]);
  const centre = /^Fixture PC One at 15\.6%, 43\.8%/;
  await expect(theirs.tokenGroup.getByRole("button", { name: centre })).toBeVisible();
  await expect(view.tokenGroup.getByRole("button", { name: centre })).toBeVisible();

  // A Large token fills four squares: twice as wide.
  const ring = async () =>
    (await theirs.token("Fixture PC One").locator("circle").first().boundingBox())!.width;
  const medium = await ring();
  await view.token("Fixture PC One").click();
  await page.getByLabel("Size").selectOption({ label: "Large (2 × 2 squares)" });
  await expect.poll(async () => (await ring()) / medium).toBeGreaterThan(1.8);

  // How far everyone else is, for measuring without a mouse.
  await view.placeMember("Fixture PC Two", LIT_TOO);
  await expect(
    player.page.getByRole("list", { name: "Distances from Fixture PC One" }),
  ).toContainText(/Fixture PC Two\s*[\d.]+ ft/);

  // Snapping off: tokens go exactly where they're put.
  const snap = page.getByRole("switch", { name: "Snap to grid" });
  await snap.click();
  await expect(snap).toHaveAttribute("aria-checked", "false");
  await theirs.reload();
  await theirs.live();
  await theirs.dragToken("Fixture PC One", [0.147, 0.41]);
  await expect
    .poll(() =>
      view.whereIs("Fixture PC One").then((at) => near(at, [0.147, 0.41]) && at[0] !== 0.156),
    )
    .toBe(true);
});

test("a map that isn't shared takes no token changes from players", async ({ api, openAs }) => {
  const map = await api.createMap();
  const player = await openAs("playerOne");
  const response = await player.api.tokensRequest(map, [
    { type: "move", id: "anything", to: [0.1, 0.1] },
  ]);
  expect(response.status()).toBe(404);
});
