import { expect, test, type App, type Who } from "./support/fixtures";
import { SIGNED_IN } from "./support/sign-in";
import { uniqueName } from "./support/test-data";

/**
 * The DM giving items to a player. Tests start as the DM; Player One gets a second browser. Items
 * have unique names, since other specs use Fixture PC One's bag too.
 */

test("the DM gives an item, and the player finds it new in their bag", async ({
  characters,
  openAs,
}) => {
  const potion = uniqueName("Potion");
  const bag = await characters.openBag("Fixture PC One");
  await bag.give(potion, new RegExp(`^Add ${potion}`));
  await expect(bag.tile(`${potion}, new`)).toBeVisible();
  // The DM looking at it doesn't count as the player having seen it.
  await bag.tile(`${potion}, new`).click();
  await bag.details(potion).getByRole("button", { name: "Close" }).click();

  const player = await openAs("playerOne");
  const theirs = await player.characters.openBag("Fixture PC One");
  await theirs.tile(`${potion}, new`).click();
  await expect(theirs.details(potion)).toContainText("Given by the DM");
  await theirs.details(potion).getByRole("button", { name: "Close" }).click();
  await expect(theirs.tile(potion)).toBeVisible();
  await theirs.saved();
  await player.reload();
  await expect(theirs.tile(potion)).toBeVisible();
});

test("the DM can split and restack their own gifts, which stay new", async ({ characters }) => {
  const cheese = uniqueName("Cheese");
  const bag = await characters.openBag("Fixture PC One");
  await bag.give(`2 ${cheese}`, new RegExp(`^Add 2 × ${cheese}`));
  await bag.split(bag.tile(`${cheese}, 2, new`), cheese);
  await expect(bag.tile(`${cheese}, new`)).toHaveCount(2);

  await bag.keyboardDrag(bag.tile(`${cheese}, new`).last(), cheese, [
    ["ArrowLeft", `Over ${cheese}: drop to stack.`],
  ]);
  await expect(bag.tile(`${cheese}, 2, new`)).toBeVisible();
});

test("a player with their sheet open picks up a gift when they come back to it", async ({
  characters,
  openAs,
}) => {
  const gem = uniqueName("Gem");
  const player = await openAs("playerOne");
  const theirs = await player.characters.openBag("Fixture PC One");

  const bag = await characters.openBag("Fixture PC One");
  await bag.give(gem, new RegExp(`^Add ${gem}`));

  await player.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(theirs.tile(`${gem}, new`)).toBeVisible();
  await expect(player.page.getByRole("list", { name: "Notices" })).toContainText(
    "Updated with changes made elsewhere.",
  );
});

test("an item whose note is kept from players shows them only its name", async ({
  characters,
  openAs,
  page,
}) => {
  const bag = await characters.openBag("Fixture PC One");
  await page.getByRole("button", { name: "+ Give item" }).click();
  await page.getByRole("combobox", { name: "Give item" }).fill("Fixture Secret Relic");
  const suggestion = page.getByRole("option", { name: /^Fixture Secret Relic/ });
  await expect(suggestion).toContainText("players can’t read its note yet");
  await suggestion.click();
  await page.getByRole("button", { name: "Done" }).click();
  await bag.saved();

  const player = await openAs("playerOne");
  const theirs = await player.characters.openBag("Fixture PC One");
  await theirs
    .tile(/^Fixture Secret Relic/)
    .first()
    .click();
  const details = theirs.details("Fixture Secret Relic");
  await expect(details).toContainText("Given by the DM");
  await expect(details).not.toContainText("From the wiki");
  expect(await player.page.content()).not.toContain("unidentified item");
});

test.describe("between characters", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  /** Makes sure the companion and Fixture PC Two have bags to give to, as the DM. */
  async function setUpParty(openAs: (who: Who) => Promise<App>) {
    const dm = await openAs("dm");
    await dm.characters.openSheet("Fixture Companion");
    return (await dm.characters.openSheet("Fixture PC Two")).path;
  }

  test("a player gives part of a stack to the shared companion", async ({
    characters,
    openAs,
    page,
  }) => {
    await setUpParty(openAs);
    const bolts = uniqueName("Bolts");
    const bag = await characters.openBag("Fixture PC One");
    await bag.quickAdd(`3 ${bolts}`);
    await bag.saved();

    await bag.tile(`${bolts}, 3`).press("g");
    const details = bag.details(bolts);
    await details.getByRole("spinbutton", { name: "How many to give" }).fill("2");
    await details.getByRole("combobox").selectOption({ label: "Fixture Companion (companion)" });
    await details.getByRole("button", { name: "Give", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `Gave 2 ${bolts} to Fixture Companion` }),
    ).toBeVisible();
    await expect(bag.tile(bolts)).toBeVisible();

    const companion = await characters.openCompanionBag("Fixture Companion");
    await companion.tile(`${bolts}, 2, new`).click();
    await expect(companion.details(bolts)).toContainText("Given by Fixture PC One");
  });

  test("a player drags an item onto another player's portrait to give it", async ({
    characters,
    openAs,
    page,
  }) => {
    const pcTwo = await setUpParty(openAs);
    const letter = uniqueName("Letter");
    const bag = await characters.openBag("Fixture PC One");
    await bag.quickAdd(letter);
    await bag.saved();

    const portrait = page.getByRole("region", { name: "Give to" }).getByText("Fixture PC Two");
    await bag.drag(bag.tile(letter), portrait);
    await expect(bag.tile(letter)).toHaveCount(0);

    // Player One can't open Fixture PC Two's bag; the DM checks it arrived.
    const dm = await openAs("dm");
    await dm.goto(`${pcTwo}?bag`);
    await expect(dm.characters.bag.tile(`${letter}, new`)).toBeVisible();
  });

  test("a player can't give from someone else's bag", async ({ api, characters, openAs }) => {
    const pcTwo = await setUpParty(openAs);
    const own = (await characters.openSheet("Fixture PC One")).path;
    const response = await api.post(`${pcTwo}/give`, {
      item: "anything",
      amount: 1,
      to: own.split("/").at(-1),
    });
    expect(response.status()).toBe(404);
  });
});
