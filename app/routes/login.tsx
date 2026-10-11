import { data, Form, redirect, useActionData, useSearchParams } from "react-router";
import { notFound } from "~/.server/not-found";
import { DEV_DM, devProfile, isLoopback } from "~/.server/auth/dev-login";
import { partyPlayers } from "~/.server/members/players";
import { safeRedirect } from "~/.server/safe-redirect";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";
import { accountContext, clientAddressContext, servicesContext, type Services } from "~/context";
import type { DiscordProfile } from "~/members/types";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign in · Guildhall" }];
}

export function loader({ request, context }: Route.LoaderArgs) {
  const redirectTo = safeRedirect(new URL(request.url).searchParams.get("redirectTo"));
  if (context.get(accountContext).kind === "member") throw redirect(redirectTo);
  const { config, vault, discord } = context.get(servicesContext);
  return {
    discord: !!discord,
    devLogin: config.devLogin,
    devPlayers: config.devLogin ? partyPlayers(vault.current) : [],
  };
}

/** What went wrong with a Discord sign-in, from `?problem=` (see auth-discord-callback). */
const PROBLEMS: Record<string, string> = {
  cancelled: "Sign-in was cancelled at Discord.",
  expired: "That sign-in took too long, or was started in another tab or browser. Try again.",
  discord: "Discord couldn't confirm who you are just now. Try again in a moment.",
  full: "Too many people are waiting to be let in. Ask the DM to clear the list, then try again.",
};

/**
 * Dev sign-in (form `intent=dev`): signs in as the DM, a player from the PC notes, or someone
 * new who has to wait for the DM. Only when DEV_LOGIN is on, and only from this computer.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const services = context.get(servicesContext);
  if (!services.config.devLogin || !isLoopback(context.get(clientAddressContext))) {
    notFound();
  }
  const form = await request.formData();
  const who = String(form.get("who") ?? "");
  const redirectTo = safeRedirect(form.get("redirectTo"));

  let signedIn;
  if (who === "dm") {
    signedIn = await services.members.signIn(DEV_DM, { approve: true });
  } else if (who.startsWith("player:")) {
    const player = partyPlayers(services.vault.current).find((p) => `player:${p.id}` === who);
    if (!player) return data({ error: "There's no such player in the PC notes." }, 400);
    signedIn = await signInAsPlayer(services, devProfile(player.name), player.id);
  } else {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return data({ error: "Give the newcomer a name." }, 400);
    signedIn = await services.members.signIn(devProfile(name));
  }
  if (!("member" in signedIn)) {
    return data({ error: "The waiting list is full; ask the DM to clear it." }, 409);
  }

  const session = await services.sessions.getSession();
  session.set("discordId", signedIn.member.discordId);
  session.set("sessionKey", signedIn.member.sessionKey);
  session.set("issuedAt", Date.now());
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await services.sessions.commitSession(session) },
  });
}

async function signInAsPlayer(services: Services, profile: DiscordProfile, playerId: string) {
  const result = await services.members.signIn(profile, { approve: true });
  if (!("member" in result)) return result;
  const member = await services.members.assignPlayer(profile.discordId, playerId);
  return member ? { member } : result;
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const redirectTo = params.get("redirectTo") ?? "/";
  const problem = PROBLEMS[params.get("problem") ?? ""];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-title text-4xl">Sign in to Guildhall</h1>
      {problem && (
        <p role="alert" className="bg-warn-surface text-warn rounded-md px-3 py-2 text-sm">
          {problem}
        </p>
      )}
      {!loaderData.devLogin && !loaderData.discord && (
        <p className="text-muted">Signing in isn't set up on this server yet.</p>
      )}

      {loaderData.discord && (
        <Form method="post" action="/auth/discord" reloadDocument className="flex flex-col gap-2">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="rounded-md bg-[#5865F2] px-4 py-2.5 font-semibold text-white hover:bg-[#4752c4]"
          >
            Sign in with Discord
          </button>
          <p className="text-muted text-center text-xs">
            Guildhall only learns your Discord name. New here? The DM lets you in after you sign in.
          </p>
        </Form>
      )}

      {loaderData.devLogin && (
        <section aria-labelledby="dev-login" className={`${panelClass} flex flex-col gap-4`}>
          <div>
            <h2 id="dev-login" className="font-semibold">
              Dev sign-in
            </h2>
            <p className="text-muted text-sm">
              For development on this computer only; pretend accounts, no Discord.
            </p>
          </div>
          <Form method="post" className="flex flex-col gap-2">
            <input type="hidden" name="intent" value="dev" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" name="who" value="dm" className={primaryButtonClass}>
              Sign in as the DM
            </button>
            {loaderData.devPlayers.map((player) => (
              <button
                key={player.id}
                type="submit"
                name="who"
                value={`player:${player.id}`}
                className={buttonClass}
              >
                Sign in as {player.name}
              </button>
            ))}
          </Form>
          <Form method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="dev" />
            <input type="hidden" name="who" value="new" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Someone new</span>
              <input name="name" className={inputClass} placeholder="Their name" />
            </label>
            <button type="submit" className={buttonClass}>
              Sign in as someone new
            </button>
          </Form>
        </section>
      )}

      {actionData && "error" in actionData && (
        <p role="alert" className="text-danger text-sm">
          {actionData.error}
        </p>
      )}
    </main>
  );
}
