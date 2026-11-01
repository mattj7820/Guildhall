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

/**
 * The board is shared by every test (and every repeat or retry): each puts up cards of its own,
 * named with the run's tag, and picks them by keyboard, since cards put up at the same moment by
 * other tests may overlap.
 */
test.describe("Notice board cards and string", () => {
  const tag = () => `${test.info().repeatEachIndex}.${test.info().retry}`;

  test("a player's card reaches the others at once, and only its writer takes it down", async ({
    openAs,
  }) => {
    const text = `Fixture live ${tag()}`;
    const one = await openAs("playerOne");
    const two = await openAs("playerTwo");
    await two.board.open();
    await one.board.open();
    await one.board.writeCard(text);

    const theirs = two.board.card(text);
    await expect(theirs).toContainText("Player One");
    await expect(theirs.getByRole("button", { name: "Take down" })).toHaveCount(0);

    await one.board.cardTool(text, "Take down");
    await expect(theirs).toHaveCount(0);
  });

  test("the DM's pinned note stays theirs until they show it", async ({ board, openAs }) => {
    const caption = `Fixture caption ${tag()}`;
    const player = await openAs("playerOne");
    await player.board.open();
    await board.open();
    await board.pinNote("NPCs/Fixture Board Pin", caption);

    const pinned = board.card("Fixture Board Pin (DM only)").filter({ hasText: caption });
    await expect(pinned).toBeVisible();
    const theirs = player.board.card("Fixture Board Pin").filter({ hasText: caption });
    await expect(theirs).toHaveCount(0);

    await pinned.getByRole("button", { name: "Show players" }).press("Enter");
    await expect(theirs).toBeVisible();
    await theirs.getByRole("link", { name: "Fixture Board Pin" }).press("Enter");
    await expect(player.wiki.heading("Fixture Board Pin")).toBeVisible();
  });

  test("string tied by a player shows for everyone who sees both cards", async ({
    board,
    openAs,
  }) => {
    const text = `Fixture tied ${tag()}`;
    const label = `Fixture label ${tag()}`;
    const one = await openAs("playerOne");
    await board.open();
    await one.board.open();
    await one.board.writeCard(text);
    await one.board.tie(text, "Sessions", label);
    await expect(board.stringLabel(label)).toBeVisible();
  });

  test("players can't tie string to a card they can't see, or move the DM's", async ({
    api,
    openAs,
  }) => {
    // The DM's card, never shown: its ID is only known from the DM's answer.
    const hidden = `fixture-hidden-${tag()}`;
    const response = await api.post("/board/actions", {
      actions: [
        { type: "write", id: hidden, text: `Fixture DM only ${tag()}`, at: { x: 0.9, y: 0.9 } },
      ],
    });
    expect(response.ok()).toBe(true);

    const player = await openAs("playerOne");
    await player.board.open();
    await expect(player.board.card(`Fixture DM only ${tag()}`)).toHaveCount(0);
    const tie = await player.api.post("/board/actions", {
      actions: [{ type: "tie", id: `fixture-probe-${tag()}`, from: "next", to: hidden }],
    });
    expect(tie.status()).toBe(403);
    const move = await player.api.post("/board/actions", {
      actions: [{ type: "place", id: "next", at: { x: 0.5, y: 0.5 } }],
    });
    expect(move.status()).toBe(403);
  });
});
