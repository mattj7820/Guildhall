import { data, type MiddlewareFunction } from "react-router";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import { accountContext, servicesContext, viewerContext, type Services } from "~/context";
import { previewingAsPlayer } from "../viewer";
import { resolveAccount, viewerFor } from "./account";
import { DEV_DM } from "./dev-login";
import { isSameOrigin } from "./origin";
import { REFRESH_AFTER_MS } from "./sessions";

/**
 * Works out who is making each request, once, for every loader and action: checks that changes
 * come from Guildhall's own pages, reads the session, and sets the account and the viewer that
 * every visibility decision takes. Refreshes the session cookie once a day while it's in use.
 */
export const authMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const services = context.get(servicesContext);
  if (!isSameOrigin(request, services.config)) {
    throw data("This request didn't come from Guildhall's own pages.", { status: 403 });
  }

  const session = await services.sessions.getSession(request.headers.get("Cookie"));
  const discordId = session.get("discordId");
  const member = discordId ? await services.members.get(discordId) : undefined;
  const account = resolveAccount(
    { discordId, sessionKey: session.get("sessionKey") },
    member,
    dmDiscordIds(services),
  );
  context.set(accountContext, account);

  const preview = await previewingAsPlayer(request);
  // Not enforced yet: someone not signed in still gets the old preview toggle's view.
  context.set(viewerContext, viewerFor(account, preview) ?? (preview ? PLAYER_VIEWER : DM_VIEWER));

  const response = await next();

  const issuedAt = session.get("issuedAt") ?? 0;
  if (
    account.kind !== "anonymous" &&
    isPageLoad(request) &&
    Date.now() - issuedAt > REFRESH_AFTER_MS
  ) {
    session.set("issuedAt", Date.now());
    const headers = new Headers(response.headers);
    headers.append("Set-Cookie", await services.sessions.commitSession(session));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
};

/** The DM's Discord IDs from the settings, plus the pretend DM when dev sign-in is on. */
export function dmDiscordIds({ config }: Pick<Services, "config">): ReadonlySet<string> {
  return new Set(
    config.devLogin ? [...config.dmDiscordIds, DEV_DM.discordId] : config.dmDiscordIds,
  );
}

/** A browser loading a page, not data, an image or a form post: the time to refresh a cookie. */
function isPageLoad(request: Request): boolean {
  return (
    request.method === "GET" &&
    !new URL(request.url).pathname.endsWith(".data") &&
    (request.headers.get("Accept") ?? "").includes("text/html")
  );
}
