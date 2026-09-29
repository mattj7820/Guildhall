import type { Config } from "../config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request that changes something came from Guildhall's own pages. Browsers always send
 * `Origin` with a POST, so a form on another site (or another subdomain, which counts as the same
 * site for cookies) can't act as a signed-in user. React Router checks this for its routes, but
 * not for resource routes such as the view toggle and sign-out, so it's checked here for all.
 *
 * Once PUBLIC_URL is set, only that address is accepted. Until then (local use) the request's
 * own address is, so opening Guildhall by a LAN address still works.
 */
export function isSameOrigin(
  request: Request,
  config: Pick<Config, "publicUrl" | "publicUrlIsSet">,
): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("Origin");
  const expected = config.publicUrlIsSet ? config.publicUrl : new URL(request.url).origin;
  return origin === expected;
}

/**
 * Whether a live connection was opened by Guildhall's own pages. Opening a websocket is a GET, so
 * `isSameOrigin` would let it through, and a page on another site could then act as the signed-in
 * user over the socket. Browsers always send `Origin` when opening one, so it's required here.
 */
export function isOwnSocketOrigin(
  request: Request,
  config: Pick<Config, "publicUrl" | "publicUrlIsSet">,
): boolean {
  const expected = config.publicUrlIsSet ? config.publicUrl : new URL(request.url).origin;
  return request.headers.get("Origin") === expected;
}
