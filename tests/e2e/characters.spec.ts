import { expect, test, type App, type Who } from "./support/fixtures";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The Characters page and who can open which sheet. The fixture party is Fixture PC One (Player
 * One), Fixture PC Two (Player Two) and Fixture Companion, shared by everyone. Tests share the
 * server, so a sheet may already have been started by another test.
 */

test("the DM sees the whole party and can open every sheet", async ({ app, characters, page }) => {
  await app.goto("/");
  await app.navLink("Characters").click();
  await expect(page.getByRole("heading", { name: "Characters", level: 1 })).toBeVisible();
  for (const name of ["Fixture PC One", "Fixture PC Two", "Fixture Companion"]) {
    await expect(characters.card(name)).toBeVisible();
  }

  await characters.openSheet("Fixture PC Two");
  await expect(page.getByRole("region", { name: "Ability scores" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Skills" })).toContainText("Sleight of Hand");
});

test("the DM previewing as a player can open the shared companion, but not the PCs", async ({
  characters,
}) => {
  await characters.open();
  await characters.previewAsPlayer();
  await expect(characters.card("Fixture PC One").getByRole("link", { name: /^Open/ })).toHaveCount(
    0,
  );
  await characters.openSheet("Fixture Companion");
  await characters.backToDmView();
});

test.describe("as Player One", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  /** Fixture PC Two's sheet, started by the DM if no test has yet; answers with its path. */
  async function pcTwoSheet(openAs: (who: Who) => Promise<App>) {
    const dm = await openAs("dm");
    return (await dm.characters.openSheet("Fixture PC Two")).path;
  }

  test("opens their own sheet, with their PC note as its story", async ({ characters, page }) => {
    await characters.openSheet("Fixture PC One");
    await page.getByRole("tab", { name: "Story" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Fixture: a player character note.");
  });

  test("sees only a summary of someone else's character", async ({ characters, openAs }) => {
    await pcTwoSheet(openAs);

    await characters.open();
    const card = characters.card("Fixture PC Two");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveCount(0);
    await expect(card.getByRole("button")).toHaveCount(0);
    await expect(card).not.toContainText("Hit points");
  });

  test("gets the same 404 for someone else's sheet as for one that doesn't exist", async ({
    api,
    app,
    openAs,
    page,
  }) => {
    const otherSheet = await pcTwoSheet(openAs);

    expect((await app.goto(otherSheet))?.status()).toBe(404);
    const theirs = await page.locator("main").innerText();

    expect((await app.goto("/characters/no-such-character"))?.status()).toBe(404);
    expect(await page.locator("main").innerText()).toBe(theirs);

    expect((await api.request.get(`${otherSheet}/portrait`)).status()).toBe(404);
    // The sheet's data for opening it beside the map, too.
    expect((await api.request.get(`${otherSheet}/sheet`)).status()).toBe(404);
    expect((await api.request.get("/characters/no-such-character/sheet")).status()).toBe(404);
  });

  test("can't start a sheet for someone else's character", async ({ api }) => {
    const response = await api.postForm("/characters", {
      intent: "start",
      note: "Party/Fixture PC Two",
    });
    expect(response.status()).toBe(404);
  });

  test("opens the shared companion, whose hidden statblock never reaches them", async ({
    characters,
    page,
  }) => {
    await characters.openSheet("Fixture Companion");
    await expect(page.getByRole("region", { name: "Statblock: Fixture Companion" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Fixture Secret Form");
  });
});
