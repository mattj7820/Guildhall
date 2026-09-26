import { expect, test } from "@playwright/test";

test.describe("Hub home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads with the app title", async ({ page }) => {
    await expect(page).toHaveTitle("Guildhall");
    await expect(page.getByRole("heading", { level: 1, name: "Guildhall" })).toBeVisible();
  });

  test("links to the configured Roll20 campaign in a new tab", async ({ page }) => {
    const roll20 = page.getByRole("link", { name: /Roll20/ });
    await expect(roll20).toHaveAttribute(
      "href",
      "https://app.roll20.net/campaigns/details/0000000/fixture",
    );
    await expect(roll20).toHaveAttribute("target", "_blank");
  });

  test("opens the wiki module", async ({ page }) => {
    await page.getByRole("link", { name: /Campaign wiki/ }).click();
    await expect(page).toHaveURL("/wiki");
    await expect(page.getByRole("heading", { level: 1, name: "Campaign wiki" })).toBeVisible();
  });
});
