import { data, redirect, type MiddlewareFunction } from "react-router";
import { PLAYER_VIEWER } from "~/campaign/types";
import { accountContext, servicesContext, viewerContext } from "~/context";
import { access } from "./access";
import { identify } from "./identify";
import { isSameOrigin } from "./origin";
import { REFRESH_AFTER_MS } from "./sessions";

/**
 * Works out who is making each request, once, for every loader and action: checks that changes
 * come from Guildhall's own pages, reads the session, and sets the account and the viewer that
 * every visibility decision takes. Refreshes the session cookie once a day while it's in use.
 */
export const authMiddleware: MiddlewareFunction<Response> = async (
  { request, context, url },
  next,
) => {
  const services = context.get(servicesContext);
  if (!isSameOrigin(request, services.config)) {
    throw data("This request didn't come from Guildhall's own pages.", { status: 403 });
  }

  const { session, account, viewer } = await identify(request, services);
  context.set(accountContext, account);

  const verdict = access(account, url, { wantsPage: wantsPage(request) });
  if ("redirect" in verdict) throw redirect(verdict.redirect);
  if ("status" in verdict) throw data("Sign in to Guildhall first.", { status: verdict.status });

  // Pages open to everyone (signing in) get the least a viewer can see.
  context.set(viewerContext, viewer ?? PLAYER_VIEWER);

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

/**
 * Whether the browser is showing a page (a page load, or React Router fetching a page's data),
 * so it can be sent somewhere else, rather than loading an image or other file.
 */
function wantsPage(request: Request): boolean {
  return (
    new URL(request.url).pathname.endsWith(".data") ||
    (request.headers.get("Accept") ?? "").includes("text/html")
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
