import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import { previewingAsPlayer } from "../viewer";
import { resolveAccount, viewerFor, type Account } from "./account";
import { DEV_DM } from "./dev-login";
import type { Sessions } from "./sessions";

type Session = Awaited<ReturnType<Sessions["getSession"]>>;

/**
 * Who a request comes from, and what they may see: the one place that reads the session, for
 * pages (the root middleware) and live connections alike. The viewer is undefined for anyone not
 * let in.
 */
export async function identify(
  request: Request,
  services: Pick<Services, "sessions" | "members" | "config">,
): Promise<{ session: Session; account: Account; viewer: Viewer | undefined }> {
  const session = await services.sessions.getSession(request.headers.get("Cookie"));
  const discordId = session.get("discordId");
  const member = discordId ? await services.members.get(discordId) : undefined;
  const account = resolveAccount(
    { discordId, sessionKey: session.get("sessionKey") },
    member,
    dmDiscordIds(services),
  );
  return { session, account, viewer: viewerFor(account, await previewingAsPlayer(request)) };
}

/** The DM's Discord IDs from the settings, plus the pretend DM when dev sign-in is on. */
export function dmDiscordIds({ config }: Pick<Services, "config">): ReadonlySet<string> {
  return new Set(
    config.devLogin ? [...config.dmDiscordIds, DEV_DM.discordId] : config.dmDiscordIds,
  );
}
