import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router";
import { slugOf, turnDirection, type TurnDirection } from "~/wiki/tome";

/** How many hinged strips a leaf is made of: enough for it to curl as it turns. */
const STRIPS = 6;

interface Picture {
  page: HTMLElement;
  /** How far down its page the reader had scrolled, so the leaf shows what they last saw. */
  scrolled: number;
}

/**
 * Turns the tome's right page whenever the note changes. Just before a navigation replaces the
 * page, a copy of it is kept; once the new note is in, the copy is the leaf that turns over to
 * the left (or, going back, a copy of the new note turns over onto the old one). The leaf is a
 * row of hinged strips, each a slice of the page, so it curls like paper as it turns. Its back is
 * the left page, so it lands as the page it covers and goes without a trace. The leaf is only a
 * picture: it's drawn in `layer`, hidden from assistive tech, and removed when it lands. A note
 * reached by Misty Step forms out of mist instead. With reduced motion there's neither.
 */
export function usePageTurn(
  left: RefObject<HTMLElement | null>,
  page: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
  layer: RefObject<HTMLElement | null>,
  /** Every note's slug in the book's order, to turn towards where a linked note is. */
  order: readonly string[],
  /** The book is shut (or shutting): the cover moves instead. */
  shut: boolean,
) {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const shownPath = useRef(pathname);
  const picture = useRef<Picture | null>(null);
  const shownIdx = useRef<unknown>(undefined);
  // How the next note arrives: on a turned page, or through mist (Misty Step).
  const arrival = useRef<"turn" | "mist">("turn");

  useEffect(() => {
    shownIdx.current = historyIdx();
    function keep() {
      if (!page.current) return;
      picture.current = { page: copyOf(page.current), scrolled: scroller.current?.scrollTop ?? 0 };
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
  }, [page, scroller]);

  useLayoutEffect(() => {
    // A new note starts at its top, inside the page.
    scroller.current?.scrollTo({ top: 0 });
    const before = picture.current;
    picture.current = null;
    const idx = historyIdx();
    const direction = turnDirection({
      popped: navigation === "POP",
      fromIdx: shownIdx.current,
      toIdx: idx,
      fromSlug: slugOf(shownPath.current),
      toSlug: slugOf(pathname),
      order,
    });
    shownIdx.current = idx;
    shownPath.current = pathname;
    const how = arrival.current;
    arrival.current = "turn";
    if (!before || shut || !page.current || !layer.current || reducedMotion()) return;
    if (how === "mist") mist(layer.current, page.current);
    else turn(layer.current, page.current, left.current, before, direction);
    // Only a new page turns; the book's order or the navigation type changing alone doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, left, page, scroller, layer]);

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
  const width = page.clientWidth;
  const strip = width / STRIPS;
  // Forward, the old page lifts off the new one; back, the new page comes down over the old.
  const under: HTMLElement[] = [];
  let front: Picture = before;
  if (direction === "back") {
    const old = part("gh-tome-under");
    old.append(sliceOf(before, 0, width));
    under.push(old);
    front = { page: copyOf(page), scrolled: scrollOf(page) };
  }
  // On phones the left page is a sheet kept off screen, and while reading it's folded away: then
  // the leaf's back is left blank.
  const onLeft =
    left && getComputedStyle(left).position !== "fixed" && !left.closest("[data-reading]")
      ? { page: copyOf(left), scrolled: scrollOf(left) }
      : undefined;

  const leaf = part("gh-tome-leaf");
  let hinge = leaf;
  for (let i = 0; i < STRIPS; i++) {
    const piece = i === 0 ? leaf : part("gh-tome-strip");
    // Where the strip is across the leaf, front and back, so shading runs over it unbroken.
    piece.style.setProperty("--front-at", `${-i * strip}px`);
    piece.style.setProperty("--back-at", `${-(STRIPS - 1 - i) * strip}px`);
    const face = part("gh-tome-leaf-front");
    face.append(sliceOf(front, i * strip, width));
    const back = part("gh-tome-leaf-back");
    // A strip lands mirrored: its slice of the front covers that much of the left page's far side.
    // (Strips after the first are a pixel wider, and mirrored that pixel is on the other side.)
    if (onLeft) back.append(sliceOf(onLeft, width - (i + 1) * strip - (i > 0 ? 1 : 0), width));
    piece.append(face, back);
    if (i > 0) hinge.append(piece);
    hinge = piece;
  }
  if (!onLeft) leaf.classList.add("gh-tome-leaf-blank");
  layer.style.setProperty("--strip", `${strip}px`);
  layer.style.setProperty("--leaf", `${width}px`);
  layer.replaceChildren(...under, part("gh-tome-turn-shade"), leaf);
  layer.dataset.turn = direction;
  // Copies only scroll once they're on the page.
  for (const copy of layer.querySelectorAll<HTMLElement>("[data-scrolled]")) {
    const inside = copy.querySelector<HTMLElement>(".gh-tome-scroll");
    if (inside) inside.scrollTop = Number(copy.dataset.scrolled);
  }
  leaf.addEventListener("animationend", (event) => {
    if (event.target !== leaf || event.pseudoElement || !layer.contains(leaf)) return;
    layer.replaceChildren();
    delete layer.dataset.turn;
  });
}

function mist(layer: HTMLElement, page: HTMLElement) {
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

/** One strip's view of a page: a copy of it, moved so the strip shows from `from` across. */
function sliceOf(picture: Picture, from: number, width: number): HTMLElement {
  const copy = picture.page.cloneNode(true) as HTMLElement;
  copy.style.left = `${-from}px`;
  copy.style.width = `${width}px`;
  copy.dataset.scrolled = String(picture.scrolled);
  return copy;
}

/** A still copy of a page, with nothing in it that could clash with the real one. */
export function copyOf(element: HTMLElement): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelector(".gh-tome-turn")?.remove();
  copy.classList.add("gh-tome-still");
  copy.classList.remove("gh-tome-mist");
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("[id]")])
    node.removeAttribute("id");
  return copy;
}

/** How far down its page a page (or its copy) is scrolled. */
export function scrollOf(page: HTMLElement): number {
  return page.querySelector<HTMLElement>(".gh-tome-scroll")?.scrollTop ?? 0;
}

function part(className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  return div;
}

function historyIdx(): unknown {
  return (window.history.state as { idx?: unknown } | null)?.idx;
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
