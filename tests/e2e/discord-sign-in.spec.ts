import { expect, test } from "./support/fixtures";
import { SIGNED_OUT } from "./support/sign-in";
import { ORIGIN } from "./support/test-data";

/**
 * "Sign in with Discord", as far as it can be tested without Discord: the e2e server has a
 * made-up Discord application, so these check the way to Discord and the way back, never
 * Discord itself. A real sign-in is checked by hand (see docs/deployment.md).
 */

test.use({ storageState: SIGNED_OUT });

test.describe("Discord sign-in", () => {
  test("offers it on the sign-in page", async ({ page, signIn }) => {
    await signIn.open();
    await expect(page.getByRole("button", { name: "Sign in with Discord" })).toBeVisible();
  });

  test("sends you to Discord, asking only who you are, with a fresh attempt", async ({ page }) => {
    const response = await page.request.post("/auth/discord", {
      headers: { Origin: ORIGIN },
      form: { redirectTo: "/wiki/Home" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);

    const discord = new URL(response.headers()["location"]);
    expect(discord.origin + discord.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(discord.searchParams.get("client_id")).toBe("e2e-fake-client-id");
    expect(discord.searchParams.get("scope")).toBe("identify");
    expect(discord.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/discord/callback`);
    expect(discord.searchParams.get("state")).toMatch(/^[\w-]{22}$/);
    expect(response.headers()["set-cookie"]).toMatch(/guildhall-sign-in=.*Path=\/auth/);
  });

  test("turns away an answer to an attempt this browser didn't start", async ({ app, page }) => {
    await app.goto("/auth/discord/callback?code=stolen&state=not-yours");
    await expect(page).toHaveURL("/login?problem=expired");
    await expect(page.getByRole("alert")).toContainText("started in another tab or browser");
    await app.goto("/wiki/Home");
    await expect(page).toHaveURL(/\/login/);
  });

  test("explains when someone cancels at Discord", async ({ app, page }) => {
    await app.goto("/auth/discord/callback?error=access_denied&state=anything");
    await expect(page.getByRole("alert")).toContainText("Sign-in was cancelled at Discord.");
  });
});
