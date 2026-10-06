import { expect, test as base } from "./support/fixtures";
import type { Api } from "./support/api";
import { fogRect, uniqueName, type MapRef, type Point } from "./support/test-data";

/**
 * NPC tokens and markers from the DM's Tokens tab. Tests start as the DM, with a shared map of the
 * fog fixture (1024×512) with its left third revealed; Player One gets a second browser. No party
 * members are placed here (only map-tokens.spec.ts does that).
 *
 * The NPC is Fixture Hidden NPC: a DM-only note with an image.
 */
const LIT: Point = [0.15, 0.5];
const LIT_TOO: Point = [0.2, 0.3];
const DARK: Point = [0.7, 0.5];
const HIDDEN_NPC = "NPCs/Fixture Hidden NPC";

const test = base.extend<{ lit: MapRef }>({
  /** A shared map of the fog fixture, its left third revealed. */
  lit: async ({ api }, use) => {
    await use(await sharedMap(api));
  },
});

function sharedMap(api: Api) {
  return api.createMap({
    name: uniqueName("NPCs"),
    shared: true,
    fog: [fogRect("reveal", [0, 0], [0.3, 1])],
  });
}

test("the DM adds an NPC from its note under another name; players see it only once shown and revealed", async ({
  lit,
  maps,
  openAs,
}) => {
  const view = await maps.view(lit);
  const disguise = uniqueName("Hooded figure");
  await view.addToken({ name: disguise, note: HIDDEN_NPC, shown: false, at: DARK });

  // Drawn with its note's picture, served by the token.
  const picture = view.tokenGroup.locator('image[href*="/picture"]');
  await expect(picture).toHaveCount(1);
  const pictureUrl = (await picture.getAttribute("href"))!;
  expect(pictureUrl).not.toContain("Hidden");

  const player = await openAs("playerOne");
  const theirs = await player.maps.view(lit);
  await theirs.live();
  await expect(theirs.anyTokenNamed(disguise)).toHaveCount(0);
  expect((await player.page.request.get(pictureUrl)).status()).toBe(404);

  // Shown, but still under the fog: nothing yet.
  await view.toggleShown(disguise, "show");
  await expect(view.onThisMap).toContainText("Shown");
  await expect(theirs.anyTokenNamed(disguise)).toHaveCount(0);

  // Dragged into the light: the player sees it arrive, by its own name and with its picture.
  await view.dragToken(disguise, LIT);
  await expect(theirs.anyTokenNamed(disguise)).toBeVisible();
  await expect(theirs.tokenGroup.locator('image[href*="/picture"]')).toHaveCount(1);
  expect((await player.page.request.get(pictureUrl)).status()).toBe(200);
  await expect(player.page.locator("body")).not.toContainText("Fixture Hidden NPC");
  expect(await player.page.content()).not.toContain("Fixture Hidden NPC");

  // Hidden again in one click: gone for the player, and its picture with it.
  await view.toggleShown(disguise, "hide");
  await expect(theirs.anyTokenNamed(disguise)).toHaveCount(0);
  expect((await player.page.request.get(pictureUrl)).status()).toBe(404);
});

test("the DM places several numbered markers with an icon", async ({ lit, maps, openAs }) => {
  const view = await maps.view(lit);
  const bandit = uniqueName("Bandit");
  await view.addToken({ name: bandit, count: 3, icon: "Rogue", shown: true, at: LIT });
  for (const each of [1, 2, 3]) await expect(view.token(`${bandit} ${each}`)).toBeVisible();
  await expect(view.onThisMap).toContainText(`${bandit} 3`);

  const theirs = await (await openAs("playerOne")).maps.view(lit);
  await expect(theirs.anyTokenNamed(`${bandit} 2`)).toBeVisible();
});

test("the DM sets a token aside and places it again, and sends one to another map", async ({
  api,
  lit,
  maps,
  page,
}) => {
  const other = await sharedMap(api);
  const view = await maps.view(lit);
  const innkeeper = uniqueName("Innkeeper");
  await view.addToken({ name: innkeeper, icon: "Tavern", shown: true, at: LIT });

  await view.token(innkeeper).click();
  await view.tokenSettings(innkeeper).getByRole("button", { name: "Set aside" }).click();
  await expect(view.anyTokenNamed(innkeeper)).toHaveCount(0);
  const aside = page.getByRole("list", { name: "Set aside" });
  await aside.getByRole("button", { name: `Place: ${innkeeper}` }).click();
  await view.click(LIT_TOO);
  await expect(view.token(innkeeper)).toBeVisible();
  await view.expectTokenNear(innkeeper, LIT_TOO);

  await view.token(innkeeper).click();
  await view.tokenSettings(innkeeper).getByLabel("Send to map").selectOption(other.name);
  await expect(view.anyTokenNamed(innkeeper)).toHaveCount(0);
  const there = await maps.view(other);
  await expect(there.token(innkeeper)).toBeVisible();
});
