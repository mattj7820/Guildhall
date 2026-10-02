import { expect, test } from "./support/fixtures";

test.describe("Wiki search", () => {
  test("finds a note by a word prefix and opens it", async ({ page, wiki }) => {
    await wiki.open();
    await wiki.search("stoneh");

    await wiki.searchResults.getByRole("link", { name: "Mira Stonehand" }).click();
    await expect(page).toHaveURL("/wiki/NPCs/Mira%20Stonehand");
  });

  test("finds a note by its alias", async ({ wiki }) => {
    await wiki.open();
    await wiki.search("Start Here");

    await expect(wiki.searchResults.getByRole("link").first()).toHaveText("Home");
  });

  test("says so when nothing matches", async ({ wiki }) => {
    await wiki.goto("/wiki?q=zzzzqqqq");
    await expect(wiki.nothingMatches("zzzzqqqq")).toBeVisible();
  });
});
