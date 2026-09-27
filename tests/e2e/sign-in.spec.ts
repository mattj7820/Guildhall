import { expect, test, type Page } from "@playwright/test";

/**
 * Signing in and out, with dev sign-in (pretend accounts, no Discord), which the e2e server turns
 * on. "Player One" plays "Fixture PC One" in the fixture vault.
 */

const main = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("Signing in", () => {
  test("signs in as the DM, and out again", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in as the DM" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Dev DM")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Combat" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("Dev DM")).toHaveCount(0);
  });

  test("signs in as a player, who sees the players' view", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in as Player One" }).click();

    await expect(page.getByText("Player One")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Combat" })).toHaveCount(0);
  });

  test("returns to the page that asked for a sign-in", async ({ page }) => {
    await page.goto("/login?redirectTo=%2Fwiki%2FHome");
    await page.getByRole("button", { name: "Sign in as the DM" }).click();
    await expect(page).toHaveURL("/wiki/Home");
  });

  test("refuses forms posted from another site", async ({ page }) => {
    const fromElsewhere = { headers: { Origin: "https://evil.example.net" }, maxRedirects: 0 };

    // Pages are checked by React Router itself…
    const signIn = await page.request.post("/login", {
      ...fromElsewhere,
      form: { intent: "dev", who: "dm" },
    });
    expect(signIn.status()).toBe(400);
    expect(signIn.headers()["set-cookie"]).toBeUndefined();

    // …and resource routes, which it doesn't check, by Guildhall.
    const signOut = await page.request.post("/logout", fromElsewhere);
    expect(signOut.status()).toBe(403);
  });
});
