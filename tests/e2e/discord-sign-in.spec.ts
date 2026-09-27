import { expect, test } from "@playwright/test";
import { SIGNED_OUT } from "./support/sign-in";

/**
 * "Sign in with Discord", as far as it can be tested without Discord: the e2e server has a
 * made-up Discord application, so these check the way to Discord and the way back, never
 * Discord itself. A real sign-in is checked by hand (see docs/deployment.md).
 */

test.use({ storageState: SIGNED_OUT });

const ORIGIN = "http://localhost:4173";

test.describe("Discord sign-in", () => {
  test("offers it on the sign-in page", async ({ page }) => {
    await page.goto("/login");
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

  test("turns away an answer to an attempt this browser didn't start", async ({ page }) => {
    await page.goto("/auth/discord/callback?code=stolen&state=not-yours");
    await expect(page).toHaveURL("/login?problem=expired");
    await expect(page.getByRole("alert")).toContainText("started in another tab or browser");
    await page.goto("/wiki/Home");
    await expect(page).toHaveURL(/\/login/);
  });

  test("explains when someone cancels at Discord", async ({ page }) => {
    await page.goto("/auth/discord/callback?error=access_denied&state=anything");
    await expect(page.getByRole("alert")).toContainText("Sign-in was cancelled at Discord.");
  });
});
