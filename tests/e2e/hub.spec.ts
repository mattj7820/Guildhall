import { expect, test } from "./support/fixtures";

test.describe("Hub home page", () => {
  test.beforeEach(async ({ app }) => {
    await app.goto("/");
  });

  test("loads with the app title", async ({ page }) => {
    await expect(page).toHaveTitle("Guildhall");
    await expect(page.getByRole("heading", { level: 1, name: "Guildhall" })).toBeVisible();
  });

  test("leads to the latest session note players may read", async ({ page, wiki }) => {
    // Fixture: "Session 1" is the only session note.
    await page.getByRole("link", { name: "Last time: Session 1" }).click();
    await expect(wiki.heading("Session 1")).toBeVisible();
  });

  test("opens the wiki module", async ({ page, wiki }) => {
    await page.getByRole("link", { name: /Campaign wiki/ }).click();
    await expect(page).toHaveURL("/wiki");
    await expect(wiki.heading("Campaign wiki")).toBeVisible();
  });
});
