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

  test("walks to the Library on the town map, which opens the wiki", async ({ page, wiki }) => {
    await page.getByRole("link", { name: "Library: Wiki" }).click();
    await expect(page).toHaveURL("/wiki");
    await expect(wiki.heading("Campaign wiki")).toBeVisible();
  });

  test("keeps the Steward's Office (Members) from players", async ({ page, openAs }) => {
    await expect(page.getByRole("link", { name: "Steward's Office: Members" })).toBeVisible();
    const player = await openAs("playerOne");
    await player.goto("/");
    await expect(player.page.getByRole("link", { name: "Library: Wiki" })).toBeVisible();
    await expect(player.page.getByRole("link", { name: /Steward's Office/ })).toHaveCount(0);
  });

  test("the DM sets the next session, and players see it but can't change it", async ({
    page,
    openAs,
  }) => {
    const next = page.getByRole("heading", { name: "Next session" }).locator("..");
    await page.getByRole("button", { name: /^(Set|Change) the date$/ }).click();
    await next.getByLabel("Date and time").fill("2099-06-12T19:30");
    await next.getByRole("button", { name: "Save" }).click();
    await expect(next.locator("time")).toContainText(/12/);

    const player = await openAs("playerOne");
    await player.goto("/");
    const theirs = player.page.getByRole("heading", { name: "Next session" }).locator("..");
    await expect(theirs.locator("time")).toContainText(/12/);
    await expect(theirs).toContainText(/in [\d,]+ days/);
    await expect(player.page.getByRole("button", { name: /the date$/ })).toHaveCount(0);
    const response = await player.api.postForm("/?index", { at: "2099-01-01T00:00:00.000Z" });
    expect(response.status()).toBe(404);
  });

  test("shows who's here now, as they arrive", async ({ page, openAs }) => {
    const party = page.getByRole("region", { name: "The party" });
    await expect(party.getByRole("listitem", { name: "DM, here now" })).toBeVisible();
    // Other specs may have Player One open too: only arriving is certain.
    const player = await openAs("playerOne");
    await player.goto("/");
    await expect(party.getByRole("listitem", { name: "Fixture PC One, here now" })).toBeVisible();
    await expect(
      player.page.getByRole("listitem", { name: "Fixture PC One, here now" }),
    ).toBeVisible();
  });
});
