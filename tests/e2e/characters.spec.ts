import { expect, test } from "@playwright/test";
import { characterCard, openCharacter, ORIGIN } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The Characters page and who can open which sheet. The fixture party is Fixture PC One (Player
 * One), Fixture PC Two (Player Two) and Fixture Companion, shared by everyone. Tests share the
 * server, so a sheet may already have been started by another test.
 */

test("the DM sees the whole party and can open every sheet", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Characters" })
    .click();
  await expect(page.getByRole("heading", { name: "Characters", level: 1 })).toBeVisible();
  for (const name of ["Fixture PC One", "Fixture PC Two", "Fixture Companion"]) {
    await expect(characterCard(page, name)).toBeVisible();
  }

  await openCharacter(page, "Fixture PC Two");
  await expect(page.getByRole("heading", { name: "Fixture PC Two", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ability scores" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Skills" })).toContainText("Sleight of Hand");
});

test.describe("as Player One", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  test("opens their own sheet, with their PC note as its story", async ({ page }) => {
    await openCharacter(page, "Fixture PC One");
    await expect(page.getByRole("heading", { name: "Fixture PC One", level: 1 })).toBeVisible();
    await page.getByRole("tab", { name: "Story" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Fixture: a player character note.");
  });

  test("sees only a summary of someone else's character", async ({ page, browser }) => {
    // Make sure Fixture PC Two has a sheet, as the DM.
    const dm = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
    await openCharacter(await dm.newPage(), "Fixture PC Two");
    await dm.close();

    await page.goto("/characters");
    const card = characterCard(page, "Fixture PC Two");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveCount(0);
    await expect(card.getByRole("button")).toHaveCount(0);
    await expect(card).not.toContainText("Hit points");
  });

  test("gets the same 404 for someone else's sheet as for one that doesn't exist", async ({
    page,
    browser,
  }) => {
    const dm = await browser.newContext({ storageState: SIGNED_IN.dm, baseURL: ORIGIN });
    const dmPage = await dm.newPage();
    await openCharacter(dmPage, "Fixture PC Two");
    const otherSheet = new URL(dmPage.url()).pathname;
    await dm.close();

    const response = await page.goto(otherSheet);
    expect(response?.status()).toBe(404);
    const theirs = await page.locator("main").innerText();

    const missing = await page.goto("/characters/no-such-character");
    expect(missing?.status()).toBe(404);
    expect(await page.locator("main").innerText()).toBe(theirs);

    const portrait = await page.request.get(`${otherSheet}/portrait`);
    expect(portrait.status()).toBe(404);
  });

  test("can't start a sheet for someone else's character", async ({ page }) => {
    await page.goto("/characters");
    const response = await page.request.post("/characters", {
      headers: { Origin: ORIGIN },
      form: { intent: "start", note: "Party/Fixture PC Two" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
  });

  test("opens the shared companion, whose hidden statblock never reaches them", async ({
    page,
  }) => {
    await openCharacter(page, "Fixture Companion");
    await expect(page.getByRole("heading", { name: "Fixture Companion", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Statblock: Fixture Companion" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Fixture Secret Form");
  });
});
