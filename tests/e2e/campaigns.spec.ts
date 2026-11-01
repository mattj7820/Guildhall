import { expect, test } from "./support/fixtures";

/**
 * Campaigns: the DM runs one folder of the vault at a time. The Locations folder stands in for a
 * second campaign. Switching changes the app for everyone, so this spec runs on its own after
 * all the others (its own project in playwright.config.ts), and always switches back.
 */
const NAME = "Fixture Locations campaign";

test.afterEach(async ({ api }) => {
  await api.postForm("/settings/campaigns", { intent: "run", id: "first", folder: "" });
});

test("players can't see or change the campaigns", async ({ openAs }) => {
  const player = await openAs("playerOne");
  expect((await player.page.goto("/settings/campaigns"))?.status()).toBe(404);
  const response = await player.api.postForm("/settings/campaigns", {
    intent: "add",
    name: "Not theirs",
    folder: "Locations",
  });
  expect(response.status()).toBe(404);
  await player.settings.open();
  await expect(player.page.getByRole("heading", { name: "Campaigns" })).toHaveCount(0);
});

test("the DM runs another campaign, and everyone's app is only its folder", async ({
  app,
  openAs,
}) => {
  const player = await openAs("playerOne");
  await player.goto("/");
  // Fixture: "Session 1" is in Sessions, outside the other campaign's folder.
  await expect(player.page.getByRole("link", { name: "Last time: Session 1" })).toBeVisible();

  await app.campaigns.open();
  if ((await app.campaigns.campaign(NAME).count()) === 0) {
    await app.campaigns.add(NAME, "Locations");
  }
  await app.campaigns.run(NAME);

  // The player's open front page reloads as the other campaign, without them doing anything.
  await expect(player.page.getByRole("link", { name: "Last time: Session 1" })).toHaveCount(0);
  await player.wiki.openNote("Locations/Brindleford");
  await expect(player.wiki.heading("Brindleford")).toBeVisible();
  // Everything outside the folder is gone for everyone, the DM too.
  expect((await player.goto("/wiki/NPCs/Mira%20Stonehand"))?.status()).toBe(404);
  expect((await app.goto("/wiki/NPCs/Mira%20Stonehand"))?.status()).toBe(404);

  await app.campaigns.open();
  await app.campaigns.run("Unnamed campaign");
  expect((await player.goto("/wiki/NPCs/Mira%20Stonehand"))?.status()).toBe(200);
});
