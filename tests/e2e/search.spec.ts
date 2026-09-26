import { expect, test } from "@playwright/test";
import { search, searchResults } from "./support/app";

test.describe("Wiki search", () => {
  test("finds a note by a word prefix and opens it", async ({ page }) => {
    await page.goto("/wiki");
    await search(page, "stoneh");

    await searchResults(page).getByRole("link", { name: "Mira Stonehand" }).click();
    await expect(page).toHaveURL("/wiki/NPCs/Mira%20Stonehand");
  });

  test("finds a note by its alias", async ({ page }) => {
    await page.goto("/wiki");
    await search(page, "Start Here");

    await expect(searchResults(page).getByRole("link").first()).toHaveText("Home");
  });

  test("says so when nothing matches", async ({ page }) => {
    await page.goto("/wiki?q=zzzzqqqq");
    await expect(page.getByText("Nothing matches “zzzzqqqq”.")).toBeVisible();
  });
});
