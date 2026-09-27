import { data, redirect } from "react-router";
import { newAttempt } from "~/.server/auth/discord-sign-in";
import { safeRedirect } from "~/.server/safe-redirect";
import { servicesContext } from "~/context";
import type { Route } from "./+types/auth-discord";

/**
 * Starts "Sign in with Discord": remembers the attempt in a short-lived cookie, then sends the
 * browser to Discord. A POST from the sign-in page, so another site can't start one.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { discord, signInAttempts } = context.get(servicesContext);
  if (!discord) throw data("Not found", { status: 404 });
  const form = await request.formData();
  const attempt = newAttempt(safeRedirect(form.get("redirectTo")));
  return redirect(discord.authorizationUrl(attempt.state), {
    headers: { "Set-Cookie": await signInAttempts.serialize(attempt) },
  });
}

export function loader() {
  return redirect("/login");
}
