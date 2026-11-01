import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router";
import { turnDirection, type TurnDirection } from "~/wiki/tome";

interface Picture {
  page: HTMLElement;
  /** How far down the page the reader had scrolled, so the leaf shows what they last saw. */
  scrolled: number;
}

/**
 * Turns the tome's right page whenever the note changes. Just before a navigation replaces the
 * page, a copy of it is kept; once the new note is in, the copy is the leaf that turns over to
 * the left (or, going back, a copy of the new note turns over onto the old one). The back of the
 * leaf is a copy of the left page, so it lands as the page it covers and goes without a trace.
 * The leaf is only a picture: it's drawn in `layer`, hidden from assistive tech, and removed when
 * it lands. A note reached by Misty Step forms out of mist instead. With reduced motion there's
 * neither.
 */
export function usePageTurn(
  left: RefObject<HTMLElement | null>,
  page: RefObject<HTMLElement | null>,
  layer: RefObject<HTMLElement | null>,
) {
  const { pathname } = useLocation();
  const picture = useRef<Picture | null>(null);
  const shownIdx = useRef<unknown>(undefined);
  // How the next note arrives: on a turned page, or through mist (Misty Step).
  const arrival = useRef<"turn" | "mist">("turn");

  useEffect(() => {
    shownIdx.current = historyIdx();
    function keep() {
      if (!page.current) return;
      picture.current = { page: copyOf(page.current), scrolled: scrolledInto(page.current) };
    }
    // Clicks are seen before the router's own handlers, while the old page is still there.
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      if (link.origin !== window.location.origin || !link.pathname.startsWith("/wiki")) return;
      if (link.pathname !== window.location.pathname) keep();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", keep);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", keep);
    };
  }, [page]);

  useLayoutEffect(() => {
    const before = picture.current;
    picture.current = null;
    const idx = historyIdx();
    const direction = turnDirection(shownIdx.current, idx);
    shownIdx.current = idx;
    const how = arrival.current;
    arrival.current = "turn";
    if (!before || !page.current || !layer.current || reducedMotion()) return;
    if (how === "mist") mist(layer.current, page.current);
    else turn(layer.current, page.current, left.current, before, direction);
  }, [pathname, left, page, layer]);

  /** Has the next note arrive through mist rather than on a turned page. */
  return function arriveByMist() {
    arrival.current = "mist";
  };
}

function turn(
  layer: HTMLElement,
  page: HTMLElement,
  left: HTMLElement | null,
  before: Picture,
  direction: TurnDirection,
) {
  // The leaf covers what's on screen of the page, no taller than the window.
  const top = scrolledInto(page);
  const height = Math.min(page.getBoundingClientRect().height - top, window.innerHeight);
  if (height <= 0) return;

  const leaf = part("gh-tome-leaf");
  const front = part("gh-tome-leaf-front");
  const back = part("gh-tome-leaf-back");
  // Forward, the old page lifts off the new one; back, the new page comes down over the old.
  const under: HTMLElement[] = [];
  if (direction === "forward") {
    front.append(shifted(before.page, before.scrolled));
  } else {
    const old = part("gh-tome-under");
    old.append(shifted(before.page, before.scrolled));
    under.push(old);
    front.append(shifted(copyOf(page), top));
  }
  // On phones the left page is a sheet kept off screen, so the leaf's back is left blank.
  if (left && getComputedStyle(left).position !== "fixed") {
    back.append(shifted(copyOf(left), scrolledInto(left)));
  } else {
    back.classList.add("gh-tome-leaf-blank");
  }
  leaf.append(front, back);
  layer.replaceChildren(...under, part("gh-tome-turn-shade"), leaf);
  layer.style.setProperty("--turn-top", `${top}px`);
  layer.style.setProperty("--turn-height", `${height}px`);
  layer.dataset.turn = direction;
  leaf.addEventListener("animationend", (event) => {
    if (event.target !== leaf || event.pseudoElement || !layer.contains(leaf)) return;
    layer.replaceChildren();
    delete layer.dataset.turn;
  });
}

function mist(layer: HTMLElement, page: HTMLElement) {
  const top = scrolledInto(page);
  layer.style.setProperty("--turn-top", `${top}px`);
  layer.style.setProperty(
    "--turn-height",
    `${Math.min(page.getBoundingClientRect().height - top, window.innerHeight)}px`,
  );
  const wisps = part("gh-tome-wisps");
  layer.replaceChildren(wisps);
  layer.dataset.turn = "mist";
  // Restart the page's own fade, in case the last step hasn't finished.
  page.classList.remove("gh-tome-mist");
  void page.offsetWidth;
  page.classList.add("gh-tome-mist");
  wisps.addEventListener("animationend", () => {
    if (!layer.contains(wisps)) return;
    layer.replaceChildren();
    delete layer.dataset.turn;
    page.classList.remove("gh-tome-mist");
  });
}

/** A still copy of a page, with nothing in it that could clash with the real one. */
function copyOf(element: HTMLElement): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelector(".gh-tome-turn")?.remove();
  copy.classList.add("gh-tome-still");
  copy.classList.remove("gh-tome-mist");
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("[id]")])
    node.removeAttribute("id");
  return copy;
}

function shifted(copy: HTMLElement, by: number): HTMLElement {
  copy.style.marginTop = `${-by}px`;
  return copy;
}

function scrolledInto(element: HTMLElement): number {
  return Math.max(0, -element.getBoundingClientRect().top);
}

function part(className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  return div;
}

function historyIdx(): unknown {
  return (window.history.state as { idx?: unknown } | null)?.idx;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
