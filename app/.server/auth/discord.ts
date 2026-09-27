import type { DiscordProfile } from "~/members/types";

/**
 * "Sign in with Discord" (OAuth2, authorization code flow), asking only for the `identify`
 * scope: who someone is, not their email, servers or messages. Kept behind this interface so
 * the rest of the app, and its tests, never talk to Discord directly.
 */
export interface DiscordAuth {
  /** Where to send the browser to ask Discord who they are. */
  authorizationUrl(state: string): string;
  /** Exchanges the code Discord returned for the person's profile. */
  profile(code: string): Promise<DiscordProfile>;
}

export class DiscordError extends Error {
  override name = "DiscordError";
}

const DISCORD = "https://discord.com";

export function discordAuth(
  {
    clientId,
    clientSecret,
    redirectUri,
  }: { clientId: string; clientSecret: string; redirectUri: string },
  fetchFn: typeof fetch = fetch,
): DiscordAuth {
  return {
    authorizationUrl(state) {
      const url = new URL("/oauth2/authorize", DISCORD);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "identify",
        state,
        redirect_uri: redirectUri,
        // Skip Discord's consent screen for people who already agreed.
        prompt: "none",
      }).toString();
      return url.href;
    },

    async profile(code) {
      const tokenResponse = await fetchFn(`${DISCORD}/api/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!tokenResponse.ok) {
        throw new DiscordError(`Discord refused the sign-in code (${tokenResponse.status}).`);
      }
      const { access_token: accessToken } = (await tokenResponse.json()) as {
        access_token?: string;
      };
      if (!accessToken) throw new DiscordError("Discord didn't send an access token.");

      const userResponse = await fetchFn(`${DISCORD}/api/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResponse.ok) {
        throw new DiscordError(`Discord didn't say who signed in (${userResponse.status}).`);
      }
      const user = (await userResponse.json()) as {
        id?: string;
        username?: string;
        global_name?: string | null;
      };
      if (!user.id || !/^\d{17,20}$/.test(user.id) || !user.username) {
        throw new DiscordError("Discord's answer about who signed in wasn't understood.");
      }
      return {
        discordId: user.id,
        username: user.username,
        name: user.global_name || user.username,
      };
    },
  };
}
