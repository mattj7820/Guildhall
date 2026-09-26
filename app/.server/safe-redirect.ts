/**
 * Returns `target` if it's a same-site path, otherwise `/`, so user-supplied redirect targets
 * can't send people to another site (an "open redirect").
 */
export function safeRedirect(target: unknown): string {
  // Browsers treat both `//host` and `/\host` as protocol-relative URLs to another site.
  return typeof target === "string" && /^\/(?![/\\])/.test(target) ? target : "/";
}
