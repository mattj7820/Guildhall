import { expect, test } from "./support/fixtures";
import { uniqueName } from "./support/test-data";

/**
 * Each person's theme, saved on their account. A newcomer the DM lets in picks one, so the
 * shared accounts other specs use keep following the device.
 */
test.describe("Settings", () => {
  test("someone picks a theme, which follows them from page to page and only them", async ({
    app,
    members,
    openAs,
  }) => {
    const them = await openAs("signedOut");
    const name = uniqueName("Theme picker");
    await them.signIn.asNewcomer(name);
    await members.open();
    await members.letIn(name);

    await them.goto("/");
    await them.page.getByRole("link", { name }).click();
    await expect(them.page).toHaveURL("/settings");
    await expect(them.page.getByText("You haven't picked one")).toBeVisible();
    expect(await them.settings.shownIn()).toBeNull();

    await them.settings.pick("Gemlight", "gem");
    await them.goto("/wiki");
    await expect(them.page.locator("html")).toHaveAttribute("data-theme", "gem");
    await expect(them.page.locator("body")).toHaveAttribute("data-module", "wiki");

    await them.settings.open();
    await them.settings.pick("Iron and Ember", "ember");
    await expect(them.settings.theme("Gemlight")).toHaveAttribute("aria-pressed", "false");

    // The DM's own pages aren't touched by someone else's pick.
    await app.goto("/");
    await expect(app.page.locator("html")).not.toHaveAttribute("data-theme", "ember");
  });
});
