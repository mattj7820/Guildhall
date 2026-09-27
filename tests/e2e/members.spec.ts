import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueName } from "./support/app";
import { SIGNED_IN, SIGNED_OUT } from "./support/sign-in";

/**
 * The DM letting people in, choosing who they play, and removing them. Each test signs a
 * uniquely named newcomer in, in a browser of their own, while the DM uses the default one.
 * "Player Two" plays "Fixture PC Two" in the fixture vault.
 */

/** Someone new signs in with dev sign-in, in their own browser, and lands on the waiting page. */
async function newcomer(browser: Browser): Promise<{ page: Page; name: string }> {
  const context = await browser.newContext({ storageState: SIGNED_OUT });
  const page = await context.newPage();
  const name = uniqueName("Newcomer");
  await page.goto("/login");
  await page.getByLabel("Someone new").fill(name);
  await page.getByRole("button", { name: "Sign in as someone new" }).click();
  await expect(page).toHaveURL("/waiting");
  return { page, name };
}

const waitingList = (page: Page) => page.getByRole("list", { name: "Waiting" });
const memberList = (page: Page) => page.getByRole("list", { name: "Members" });

test.describe("Members", () => {
  test("the DM lets a newcomer in as a player, who then gets in", async ({ page, browser }) => {
    const them = await newcomer(browser);

    await page.goto("/members");
    const request = waitingList(page).getByRole("listitem", { name: them.name });
    await request.getByLabel(`${them.name} plays`).selectOption({ label: "Player Two" });
    await request.getByRole("button", { name: "Let in" }).click();
    await expect(memberList(page).getByRole("listitem", { name: them.name })).toBeVisible();

    await them.page.reload();
    await expect(them.page).toHaveURL("/");
    await expect(them.page.getByText(them.name)).toBeVisible();
    await expect(
      them.page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Wiki" }),
    ).toBeVisible();
  });

  test("the DM dismisses a request", async ({ page, browser }) => {
    const them = await newcomer(browser);
    await page.goto("/members");
    await waitingList(page)
      .getByRole("listitem", { name: them.name })
      .getByRole("button", { name: "Dismiss" })
      .click();
    await expect(page.getByRole("listitem", { name: them.name })).toHaveCount(0);

    // Dismissed, their sign-in no longer counts; they'd have to ask again.
    await them.page.reload();
    await expect(them.page).toHaveURL(/\/login/);
  });

  test("removing a member signs them out everywhere", async ({ page, browser }) => {
    const them = await newcomer(browser);
    await page.goto("/members");
    await waitingList(page)
      .getByRole("listitem", { name: them.name })
      .getByRole("button", { name: "Let in" })
      .click();

    const row = memberList(page).getByRole("listitem", { name: them.name });
    await row.getByRole("button", { name: "Remove…" }).click();
    await row.getByRole("button", { name: `Remove ${them.name}` }).click();
    await expect(page.getByRole("listitem", { name: them.name })).toHaveCount(0);

    await them.page.goto("/wiki/Home");
    await expect(them.page).toHaveURL(/\/login/);
  });

  test("the DM can't remove themselves", async ({ page }) => {
    await page.goto("/members");
    const you = memberList(page).getByRole("listitem", { name: "Dev DM" });
    await expect(you.getByText("That's you")).toBeVisible();
    await expect(you.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  });

  test.describe("for a player", () => {
    test.use({ storageState: SIGNED_IN.playerOne });

    test("isn't there at all", async ({ page }) => {
      expect((await page.goto("/members"))?.status()).toBe(404);
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Members" }),
      ).toHaveCount(0);
    });
  });
});
