import type { MouseEvent } from "react";
import { useNavigate } from "react-router";

/**
 * Rendered notes arrive as plain HTML, so their wikilinks are ordinary anchors. This click handler
 * routes in-app ones client-side instead of reloading the page. Modified clicks (new tab) and
 * links elsewhere are left to the browser.
 */
export function useWikilinkNavigation() {
  const navigate = useNavigate();
  return function handleClick(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a.wikilink");
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (
      !link ||
      !isPlainClick ||
      !link.pathname.startsWith("/wiki/") ||
      link.origin !== location.origin
    )
      return;
    event.preventDefault();
    navigate(link.pathname + link.hash);
  };
}
