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

test("the DM can split and restack their own gifts, which stay new", async ({ page }) => {
  const cheese = uniqueName("Cheese");
  await openBag(page);
  await give(page, `2 ${cheese}`, new RegExp(`^Add 2 × ${cheese}`));
  await tile(page, `${cheese}, 2, new`).press("s");
  await page
    .getByRole("dialog", { name: cheese })
    .getByRole("button", { name: "Split", exact: true })
    .click();
  await expect(tile(page, `${cheese}, new`)).toHaveCount(2);

  await tile(page, `${cheese}, new`).last().focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("status").filter({ hasText: `${cheese} is at position` }),
  ).toBeAttached();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("status").filter({ hasText: `Over ${cheese}: drop to stack.` }),
  ).toBeAttached();
  await page.keyboard.press("Space");
  await expect(tile(page, `${cheese}, 2, new`)).toBeVisible();
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

test.describe("between characters", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  /** Makes sure the companion and Fixture PC Two have bags to give to, as the DM. */
  async function setUpParty(browser: Browser) {
    const context = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
    const page = await context.newPage();
    await openCharacter(page, "Fixture Companion");
    await openCharacter(page, "Fixture PC Two");
    const pcTwo = new URL(page.url()).pathname;
    await context.close();
    return pcTwo;
  }

  async function addItem(page: Page, text: string) {
    await page.getByRole("button", { name: "+ Add item" }).click();
    const box = page.getByRole("combobox", { name: "Add item" });
    await box.fill(text);
    await box.press("Enter");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
  }

  test("a player gives part of a stack to the shared companion", async ({ page, browser }) => {
    await setUpParty(browser);
    const bolts = uniqueName("Bolts");
    await openBag(page);
    await addItem(page, `3 ${bolts}`);

    await tile(page, `${bolts}, 3`).press("g");
    const details = page.getByRole("dialog", { name: bolts });
    await details.getByRole("spinbutton", { name: "How many to give" }).fill("2");
    await details.getByRole("combobox").selectOption({ label: "Fixture Companion (companion)" });
    await details.getByRole("button", { name: "Give", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `Gave 2 ${bolts} to Fixture Companion` }),
    ).toBeVisible();
    await expect(tile(page, bolts)).toBeVisible();

    await openCharacter(page, "Fixture Companion");
    await tile(page, `${bolts}, 2, new`).click();
    await expect(page.getByRole("dialog", { name: bolts })).toContainText(
      "Given by Fixture PC One",
    );
  });

  test("a player drags an item onto another player's portrait to give it", async ({
    page,
    browser,
  }) => {
    const pcTwo = await setUpParty(browser);
    const letter = uniqueName("Letter");
    await openBag(page);
    await addItem(page, letter);

    const from = await tile(page, letter).boundingBox();
    const to = await page
      .getByRole("region", { name: "Give to" })
      .getByText("Fixture PC Two")
      .boundingBox();
    if (!from || !to) throw new Error("Not on screen");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 5, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(tile(page, letter)).toHaveCount(0);

    // Player One can't open Fixture PC Two's bag; the DM checks it arrived.
    const context = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
    const dm = await context.newPage();
    await dm.goto(`${pcTwo}?bag`);
    await expect(tile(dm, `${letter}, new`)).toBeVisible();
    await context.close();
  });

  test("a player can't give from someone else's bag", async ({ page, browser }) => {
    const pcTwo = await setUpParty(browser);
    await openCharacter(page, "Fixture PC One");
    const response = await page.request.post(`${pcTwo}/give`, {
      headers: { Origin: ORIGIN },
      data: { item: "anything", amount: 1, to: new URL(page.url()).pathname.split("/").at(-1) },
    });
    expect(response.status()).toBe(404);
  });
});
