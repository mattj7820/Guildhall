import { redirect } from "react-router";
import { checkCallback } from "~/.server/auth/discord-sign-in";
import { DiscordError } from "~/.server/auth/discord";
import { dmDiscordIds } from "~/.server/auth/identify";
import { notFound } from "~/.server/not-found";
import { servicesContext } from "~/context";
import type { Route } from "./+types/auth-discord-callback";

/**
 * Where Discord sends people back. Checks the answer belongs to the attempt this browser
 * started, asks Discord who they are, records the sign-in (the DM is let straight in; anyone
 * else waits until the DM approves them) and starts a session.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const { discord, signInAttempts, members, sessions } = services;
  if (!discord) notFound();

  // The attempt is used once, whatever happens next.
  const forget = await signInAttempts.serialize("", { maxAge: 0 });
  const headers = new Headers({ "Set-Cookie": forget });
  const backToLogin = (problem: string) => redirect(`/login?problem=${problem}`, { headers });

  const attempt = await signInAttempts.parse(request.headers.get("Cookie"));
  const result = checkCallback(new URL(request.url).searchParams, attempt);
  if ("problem" in result) return backToLogin(result.problem);

  let profile;
  try {
    profile = await discord.profile(result.code);
  } catch (error) {
    if (!(error instanceof DiscordError)) throw error;
    console.warn("[auth] Discord sign-in failed:", error.message);
    return backToLogin("discord");
  }

  const signedIn = await members.signIn(profile, {
    approve: dmDiscordIds(services).has(profile.discordId),
  });
  if (!("member" in signedIn)) return backToLogin("full");

  const session = await sessions.getSession();
  session.set("discordId", signedIn.member.discordId);
  session.set("sessionKey", signedIn.member.sessionKey);
  session.set("issuedAt", Date.now());
  headers.append("Set-Cookie", await sessions.commitSession(session));
  return redirect(result.redirectTo, { headers });
}
