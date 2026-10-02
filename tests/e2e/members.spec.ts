import type { App} from "./support/fixtures";
import { expect, test as base } from "./support/fixtures";
import { uniqueName } from "./support/test-data";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The DM letting people in, choosing who they play, and removing them. Each test signs a
 * uniquely named newcomer in, in a browser of their own, while the DM uses the default one.
 * "Player Two" plays "Fixture PC Two" in the fixture vault.
 */

const test = base.extend<{ newcomer: { app: App; name: string } }>({
  /** Someone new, signed in with dev sign-in in their own browser, on the waiting page. */
  newcomer: async ({ openAs }, use) => {
    const app = await openAs("signedOut");
    const name = uniqueName("Newcomer");
    await app.signIn.asNewcomer(name);
    await use({ app, name });
  },
});

test.describe("Members", () => {
  test("the DM lets a newcomer in as a player, who then gets in", async ({
    members,
    newcomer: them,
  }) => {
    await members.open();
    await members.letIn(them.name, { plays: "Player Two" });

    await them.app.reload();
    await expect(them.app.page).toHaveURL("/");
    await expect(them.app.page.getByText(them.name)).toBeVisible();
    await expect(them.app.navLink("Wiki")).toBeVisible();
  });

  test("the DM dismisses a request", async ({ members, newcomer: them }) => {
    await members.open();
    await members.dismiss(them.name);

    // Dismissed, their sign-in no longer counts; they'd have to ask again.
    await them.app.reload();
    await expect(them.app.page).toHaveURL(/\/login/);
  });

  test("removing a member signs them out everywhere", async ({ members, newcomer: them }) => {
    await members.open();
    await members.letIn(them.name);
    await members.remove(them.name);

    await them.app.goto("/wiki/Home");
    await expect(them.app.page).toHaveURL(/\/login/);
  });

  test("the DM can't remove themselves", async ({ members }) => {
    await members.open();
    const you = members.member("Dev DM");
    await expect(you.getByText("That's you")).toBeVisible();
    await expect(you.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  });

  test.describe("for a player", () => {
    test.use({ storageState: SIGNED_IN.playerOne });

    test("isn't there at all", async ({ app, members }) => {
      expect((await members.open())?.status()).toBe(404);
      await expect(app.navLink("Members")).toHaveCount(0);
    });
  });
});
