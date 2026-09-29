import { expect, test, type Browser, type Page } from "@playwright/test";
import { openCharacter, ORIGIN, uniqueName } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The DM giving items to a player. Tests start as the DM; Player One gets a second browser. Items
 * have unique names, since other specs use Fixture PC One's bag too.
 */

const grid = (page: Page) => page.getByRole("list", { name: "Inventory" });
const tile = (page: Page, name: string | RegExp) =>
  grid(page).getByRole("button", { name, exact: typeof name === "string" });
const saved = (page: Page) => expect(page.getByText("✓ All changes saved")).toBeVisible();

async function openBag(page: Page) {
  await openCharacter(page, "Fixture PC One");
  await page.getByRole("button", { name: /^Bag/ }).click();
  await expect(grid(page)).toBeVisible();
}

/** Types into quick add and picks the suggestion with this text. */
async function give(page: Page, text: string, suggestion: RegExp) {
  await page.getByRole("button", { name: "+ Give item" }).click();
  await page.getByRole("combobox", { name: "Give item" }).fill(text);
  await page.getByRole("option", { name: suggestion }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await saved(page);
}

async function asPlayerOne(browser: Browser) {
  const context = await browser.newContext({ storageState: SIGNED_IN.playerOne, baseURL: ORIGIN });
  return { page: await context.newPage(), close: () => context.close() };
}

test("the DM gives an item, and the player finds it new in their bag", async ({
  page,
  browser,
}) => {
  const potion = uniqueName("Potion");
  await openBag(page);
  await give(page, potion, new RegExp(`^Add ${potion}`));
  await expect(tile(page, `${potion}, new`)).toBeVisible();
  // The DM looking at it doesn't count as the player having seen it.
  await tile(page, `${potion}, new`).click();
  await page.getByRole("dialog", { name: potion }).getByRole("button", { name: "Close" }).click();

  const player = await asPlayerOne(browser);
  await openBag(player.page);
  await tile(player.page, `${potion}, new`).click();
  await expect(player.page.getByRole("dialog", { name: potion })).toContainText("Given by the DM");
  await player.page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(tile(player.page, potion)).toBeVisible();
  await saved(player.page);
  await player.page.reload();
  await expect(tile(player.page, potion)).toBeVisible();
  await player.close();
});

test("a player with their sheet open picks up a gift when they come back to it", async ({
  page,
  browser,
}) => {
  const gem = uniqueName("Gem");
  const player = await asPlayerOne(browser);
  await openBag(player.page);

  await openBag(page);
  await give(page, gem, new RegExp(`^Add ${gem}`));

  await player.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(tile(player.page, `${gem}, new`)).toBeVisible();
  await expect(player.page.getByRole("list", { name: "Notices" })).toContainText(
    "Updated with changes made elsewhere.",
  );
  await player.close();
});

test("an item whose note is kept from players shows them only its name", async ({
  page,
  browser,
}) => {
  await openBag(page);
  await page.getByRole("button", { name: "+ Give item" }).click();
  await page.getByRole("combobox", { name: "Give item" }).fill("Fixture Secret Relic");
  const suggestion = page.getByRole("option", { name: /^Fixture Secret Relic/ });
  await expect(suggestion).toContainText("players can’t read its note yet");
  await suggestion.click();
  await page.getByRole("button", { name: "Done" }).click();
  await saved(page);

  const player = await asPlayerOne(browser);
  await openBag(player.page);
  await tile(player.page, /^Fixture Secret Relic/)
    .first()
    .click();
  const details = player.page.getByRole("dialog", { name: "Fixture Secret Relic" });
  await expect(details).toContainText("Given by the DM");
  await expect(details).not.toContainText("From the wiki");
  expect(await player.page.content()).not.toContain("unidentified item");
  await player.close();
});
