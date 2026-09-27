import type { Account } from "./account";

/** Pages anyone can reach, signed in or not. `/healthz` is answered before React Router. */
const PUBLIC_PATHS = new Set(["/login", "/logout", "/auth/discord", "/auth/discord/callback"]);

/** What a request gets, before any loader runs. */
export type Access =
  | { allow: true }
  /** Send the browser to this page instead. */
  | { redirect: string }
  /** No page to send them to (an image, a data request): just refuse. */
  | { status: 401 };

/**
 * Who may reach what. Members reach everything, and what they see is then limited by the viewer.
 * People waiting for the DM only reach the waiting page; anyone else only the sign-in pages.
 * The URL is React Router's normalised one (no `.data` suffix).
 */
export function access(
  account: Account,
  { pathname, search }: Pick<URL, "pathname" | "search">,
  { wantsPage }: { wantsPage: boolean },
): Access {
  if (PUBLIC_PATHS.has(pathname)) return { allow: true };
  if (account.kind === "member") {
    return pathname === "/waiting" ? { redirect: "/" } : { allow: true };
  }
  if (account.kind === "waiting") {
    if (pathname === "/waiting") return { allow: true };
    return wantsPage ? { redirect: "/waiting" } : { status: 401 };
  }
  if (!wantsPage) return { status: 401 };
  const target = pathname + search;
  return {
    redirect: target === "/" ? "/login" : `/login?redirectTo=${encodeURIComponent(target)}`,
  };
}
