import { expect, test as setup } from "./support/fixtures";
import { SIGNED_IN } from "./support/sign-in";

/**
 * Signs in once with dev sign-in and saves the browser's cookies, so each test can start already
 * signed in: as the DM (the default in playwright.config.ts) or as a player.
 */

for (const [who, file] of [
  ["the DM", SIGNED_IN.dm],
  ["Player One", SIGNED_IN.playerOne],
] as const) {
  setup(`sign in as ${who}`, async ({ page, signIn }) => {
    await signIn.open();
    await signIn.as(who);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.context().storageState({ path: file });
  });
}
