import { expect, test as setup } from "@playwright/test";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Signs in once with dev sign-in and saves the browser's cookies, so each test can start already
 * signed in: as the DM (the default in playwright.config.ts) or as a player.
 */

setup("sign in as the DM", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as the DM" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.context().storageState({ path: SIGNED_IN.dm });
});

setup("sign in as Player One", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in as Player One" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.context().storageState({ path: SIGNED_IN.playerOne });
});
