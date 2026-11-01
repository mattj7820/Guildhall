/**
 * The corkboard's geometry, in fractions of the board, which keeps one shape (BOARD_ASPECT), so
 * cards sit in the same places on every screen.
 */
import type { BoardCard, BoardPoint } from "./types";

type Placed = BoardPoint & Pick<BoardCard, "kind">;

/** The board's width over its height. */
export const BOARD_ASPECT = 16 / 10;

/** A card's width, as a fraction of the board's. */
export function cardWidth(card: Pick<BoardCard, "kind">): number {
  return card.kind === "next" ? 0.26 : 0.17;
}

/** Keeps a card's corner on the board, with its whole width and a little height showing. */
export function clampToBoard(point: BoardPoint, width: number): BoardPoint {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return { x: clamp(point.x, 1 - width), y: clamp(point.y, 0.92) };
}

/** Where a card's pin is, which string ties to: the middle of its top edge. */
export function pinOf(card: Placed): BoardPoint {
  return { x: card.x + cardWidth(card) / 2, y: card.y + 0.012 };
}

/**
 * String hung between two pins, as an SVG path in a 1000-wide view of the board: it sags under
 * its own weight, more the longer it is.
 */
export function stringPath(a: BoardPoint, b: BoardPoint): string {
  const [ax, ay, bx, by] = [
    a.x * 1000,
    (a.y * 1000) / BOARD_ASPECT,
    b.x * 1000,
    (b.y * 1000) / BOARD_ASPECT,
  ];
  const sag = Math.hypot(bx - ax, by - ay) * 0.12;
  const round = (value: number) => Math.round(value * 10) / 10;
  return `M${round(ax)},${round(ay)} Q${round((ax + bx) / 2)},${round((ay + by) / 2 + sag)} ${round(bx)},${round(by)}`;
}

/** The middle of a string's curve, for its label, as fractions of the board. */
export function stringMiddle(a: BoardPoint, b: BoardPoint): BoardPoint {
  const sag = Math.hypot(b.x - a.x, (b.y - a.y) / BOARD_ASPECT) * 0.12 * BOARD_ASPECT;
  // A quadratic curve's middle is halfway between the ends' middle and its control point.
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag / 2 };
}

/** A small tilt for each card, the same every time for the same card. */
export function tiltOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 50) - 25) / 10;
}
