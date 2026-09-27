/** Checks a map's image against the size its areas were drawn against. */
import type { Size } from "./types";

/** Aspect ratios this close are the same shape: rounding in an export can shift a pixel or two. */
const TOLERANCE = 0.005;

/**
 * Whether areas drawn on an image of size `recorded` still line up on one of size `actual`.
 * Outlines are stored as fractions of the image, so any resolution of the same shape is fine;
 * a different shape (a re-crop, or a map extended on one side) moves everything.
 */
export function sameShape(recorded: Size, actual: Size): boolean {
  const ratio = (size: Size) => size.width / size.height;
  return Math.abs(ratio(actual) / ratio(recorded) - 1) <= TOLERANCE;
}
