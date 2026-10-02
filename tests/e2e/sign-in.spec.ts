import { expect, test } from "./support/fixtures";
import { ORIGIN, uniqueName } from "./support/test-data";
import { SIGNED_IN, SIGNED_OUT } from "./support/sign-in";

/**
 * Signing in and out, and who may reach what, with dev sign-in (pretend accounts, no Discord),
 * which the e2e server turns on. "Player One" plays "Fixture PC One" in the fixture vault.
 */

test.describe("Signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("sends you to sign in, then back to the page you wanted", async ({ app, page, signIn }) => {
    await app.goto("/wiki/Home");
    await expect(page).toHaveURL("/login?redirectTo=%2Fwiki%2FHome");
    await expect(app.mainNav).toHaveCount(0);

    await signIn.as("the DM");
    await expect(page).toHaveURL("/wiki/Home");
    await expect(page.getByText("Dev DM")).toBeVisible();
  });

  test("gets nothing from the vault, and no redirect for files", async ({ api }) => {
    const image = await api.request.get("/vault-asset/Attachments/mira-portrait.png", {
      maxRedirects: 0,
    });
    expect(image.status()).toBe(401);
    expect((await api.request.get("/healthz")).status()).toBe(200);
  });

  test("signs out, and is signed out for good in that browser", async ({ app, page, signIn }) => {
    await signIn.open();
    await signIn.as("the DM");
    await signIn.signOut();
    await app.goto("/combat");
    await expect(page).toHaveURL("/login?redirectTo=%2Fcombat");
  });

  test("puts someone new on the waiting list, and keeps them there", async ({
    api,
    app,
    page,
    signIn,
  }) => {
    const name = uniqueName("Newcomer");
    await signIn.asNewcomer(name);
    await expect(page.getByText(`Hi ${name}.`)).toBeVisible();

    await app.goto("/wiki/Home");
    await expect(page).toHaveURL("/waiting");
    const portrait = await api.request.get("/vault-asset/Attachments/mira-portrait.png");
    expect(portrait.status()).toBe(401);
  });

  test("refuses forms posted from another site", async ({ api }) => {
    const fromElsewhere = { headers: { Origin: "https://evil.example.net" }, maxRedirects: 0 };

    // Pages are checked by React Router itself…
    const signIn = await api.request.post("/login", {
      ...fromElsewhere,
      form: { intent: "dev", who: "dm" },
    });
    expect(signIn.status()).toBe(400);
    expect(signIn.headers()["set-cookie"]).toBeUndefined();

    // …and resource routes, which it doesn't check, by Guildhall.
    const signOut = await api.request.post("/logout", fromElsewhere);
    expect(signOut.status()).toBe(403);
  });
});

test.describe("A player", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  test("sees the players' view, with no DM tools or preview switch", async ({ app, page }) => {
    await app.goto("/");
    await expect(page.getByText("Player One")).toBeVisible();
    await expect(app.navLink("Wiki")).toBeVisible();
    // Combat is the players' view of the fight, not the DM's tracker.
    await expect(app.navLink("Combat")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview as player" })).toHaveCount(0);
  });

  test("can't open DM-only notes or tools", async ({ app, combat, page }) => {
    expect((await app.goto("/wiki/Secrets/Villain%20Plan"))?.status()).toBe(404);
    await combat.openAsPlayer();
    await expect(page.getByRole("form", { name: "Add monsters" })).toHaveCount(0);
    await app.goto("/combat/prepared");
    await expect(page.getByText("Prepared encounters are the DM's.")).toBeVisible();
    // Players see shared maps, but can't make them.
    await app.goto("/maps");
    await expect(page.getByRole("heading", { name: "Maps", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "New map" })).toHaveCount(0);
  });

  test("can't become the DM by setting the preview switch", async ({ api, combat, page }) => {
    await api.request.post("/view-mode", {
      headers: { Origin: ORIGIN },
      form: { role: "dm", redirectTo: "/" },
    });
    await combat.openAsPlayer();
    await expect(page.getByRole("form", { name: "Add monsters" })).toHaveCount(0);
  });
});
