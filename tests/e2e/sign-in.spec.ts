import { expect, test, type Page } from "@playwright/test";
import { uniqueName } from "./support/app";
import { SIGNED_IN, SIGNED_OUT } from "./support/sign-in";

/**
 * Signing in and out, and who may reach what, with dev sign-in (pretend accounts, no Discord),
 * which the e2e server turns on. "Player One" plays "Fixture PC One" in the fixture vault.
 */

const main = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("Signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("sends you to sign in, then back to the page you wanted", async ({ page }) => {
    await page.goto("/wiki/Home");
    await expect(page).toHaveURL("/login?redirectTo=%2Fwiki%2FHome");
    await expect(main(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Sign in as the DM" }).click();
    await expect(page).toHaveURL("/wiki/Home");
    await expect(page.getByText("Dev DM")).toBeVisible();
  });

  test("gets nothing from the vault, and no redirect for files", async ({ page }) => {
    const image = await page.request.get("/vault-asset/Attachments/mira-portrait.png", {
      maxRedirects: 0,
    });
    expect(image.status()).toBe(401);
    expect((await page.request.get("/healthz")).status()).toBe(200);
  });

  test("signs out, and is signed out for good in that browser", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in as the DM" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/combat");
    await expect(page).toHaveURL("/login?redirectTo=%2Fcombat");
  });

  test("puts someone new on the waiting list, and keeps them there", async ({ page }) => {
    const name = uniqueName("Newcomer");
    await page.goto("/login");
    await page.getByLabel("Someone new").fill(name);
    await page.getByRole("button", { name: "Sign in as someone new" }).click();

    await expect(page).toHaveURL("/waiting");
    await expect(page.getByRole("heading", { name: "Waiting for the DM" })).toBeVisible();
    await expect(page.getByText(`Hi ${name}.`)).toBeVisible();
    await page.goto("/wiki/Home");
    await expect(page).toHaveURL("/waiting");
    expect((await page.request.get("/vault-asset/Attachments/mira-portrait.png")).status()).toBe(
      401,
    );
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

test.describe("A player", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  test("sees the players' view, with no DM tools or preview switch", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Player One")).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Wiki" })).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Combat" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Preview as player" })).toHaveCount(0);
  });

  test("can't open DM-only notes or tools", async ({ page }) => {
    expect((await page.goto("/wiki/Secrets/Villain%20Plan"))?.status()).toBe(404);
    await page.goto("/combat");
    await expect(page.getByText("The combat tracker is DM-only for now")).toBeVisible();
    // Players see shared maps, but can't make them.
    await page.goto("/maps");
    await expect(page.getByRole("heading", { name: "Maps", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "New map" })).toHaveCount(0);
  });

  test("can't become the DM by setting the preview switch", async ({ page }) => {
    await page.goto("/");
    await page.request.post("/view-mode", {
      headers: { Origin: "http://localhost:4173" },
      form: { role: "dm", redirectTo: "/" },
    });
    await page.goto("/combat");
    await expect(page.getByText("The combat tracker is DM-only for now")).toBeVisible();
  });
});
