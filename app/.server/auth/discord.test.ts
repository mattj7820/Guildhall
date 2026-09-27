import { describe, expect, it, vi } from "vitest";
import { discordAuth, DiscordError } from "./discord";

const settings = {
  clientId: "111",
  clientSecret: "secret",
  redirectUri: "https://guildhall.example.com/auth/discord/callback",
};

/** Stands in for Discord: answers the token and user requests with the given responses. */
function fakeDiscord(token: Response, user?: Response) {
  return vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith("/oauth2/token") ? token : (user ?? new Response(null, { status: 500 })),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("discordAuth", () => {
  it("asks Discord only who someone is, and to come back to Guildhall", () => {
    const url = new URL(discordAuth(settings).authorizationUrl("state-123"));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "111",
      scope: "identify",
      state: "state-123",
      redirect_uri: settings.redirectUri,
      prompt: "none",
    });
  });

  it("exchanges the code for a token, then reads the profile", async () => {
    const fetch = fakeDiscord(
      json({ access_token: "token-abc" }),
      json({ id: "123456789012345678", username: "sam", global_name: "Sam" }),
    );
    const profile = await discordAuth(settings, fetch).profile("code-xyz");
    expect(profile).toEqual({ discordId: "123456789012345678", username: "sam", name: "Sam" });

    const [tokenUrl, tokenRequest] = fetch.mock.calls[0];
    expect(tokenUrl).toBe("https://discord.com/api/oauth2/token");
    expect(Object.fromEntries(tokenRequest.body as URLSearchParams)).toMatchObject({
      grant_type: "authorization_code",
      code: "code-xyz",
      redirect_uri: settings.redirectUri,
    });
    expect(fetch.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer token-abc" });
  });

  it("uses the username when there's no display name", async () => {
    const fetch = fakeDiscord(
      json({ access_token: "t" }),
      json({ id: "123456789012345678", username: "sam", global_name: null }),
    );
    expect((await discordAuth(settings, fetch).profile("c")).name).toBe("sam");
  });

  it.each([
    ["the code is refused", fakeDiscord(json({ error: "invalid_grant" }, 400))],
    ["there's no token", fakeDiscord(json({}))],
    ["the profile can't be read", fakeDiscord(json({ access_token: "t" }), json({}, 401))],
    [
      "the profile isn't a Discord user",
      fakeDiscord(json({ access_token: "t" }), json({ id: "../admin", username: "x" })),
    ],
  ])("fails clearly when %s", async (_name, fetch) => {
    await expect(discordAuth(settings, fetch).profile("c")).rejects.toThrow(DiscordError);
  });
});
