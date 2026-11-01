import { expect, test } from "./support/fixtures";

test.describe("Notice board", () => {
  test("the town map's notice board leads to it", async ({ app, page }) => {
    await app.goto("/");
    await page.getByRole("link", { name: "Notice board: Sessions" }).click();
    await expect(page).toHaveURL("/board");
    await expect(page.getByRole("heading", { level: 1, name: "Notice board" })).toBeVisible();
  });

  test("lists the session notes newest first, each leading to its note", async ({
    board,
    wiki,
  }) => {
    // Fixture: "Session 1" is for players, "Session 0" is the DM's.
    await board.open();
    await expect(board.sessions).toHaveText(["Session 1", "Session 0"]);
    await board.sessions.first().click();
    await expect(wiki.heading("Session 1")).toBeVisible();
  });

  test("players see only the session notes they may read", async ({ openAs }) => {
    const player = await openAs("playerOne");
    await player.board.open();
    await expect(player.board.sessions).toHaveText(["Session 1"]);
  });

  test("the DM sets the next session here, and players can't", async ({ board, openAs }) => {
    await board.open();
    await board.nextSession.getByRole("button", { name: /^(Set|Change) the date$/ }).click();
    // The same date as the front page's spec, which shares the data folder.
    await board.nextSession.getByLabel("Date and time").fill("2099-06-12T19:30");
    await board.nextSession.getByRole("button", { name: "Save" }).click();
    await expect(board.nextSession.locator("time")).toContainText(/12/);

    const player = await openAs("playerOne");
    await player.board.open();
    await expect(player.board.nextSession.locator("time")).toContainText(/12/);
    await expect(player.page.getByRole("button", { name: /the date$/ })).toHaveCount(0);
    const response = await player.api.postForm("/board", { at: "2099-01-01T00:00:00.000Z" });
    expect(response.status()).toBe(404);
  });
});
