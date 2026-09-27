/** Geometry on normalised outlines (fractions of the image's width and height). */
import type { Point, Size } from "./types";

/** Five decimal places is a twentieth of a pixel on a 4K map: enough, and keeps the file small. */
const PRECISION = 1e5;

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** An image-pixel position as a normalised point, kept on the image. */
export function normalise(x: number, y: number, size: Size): Point {
  return [round(clamp01(x / size.width)), round(clamp01(y / size.height))];
}

/** A normalised point in pixels of an image of the given size. */
export function toPixels([x, y]: Point, size: Size): [number, number] {
  return [x * size.width, y * size.height];
}

/** Moves a point by a normalised offset, kept on the image. */
export function offset([x, y]: Point, dx: number, dy: number): Point {
  return [round(clamp01(x + dx)), round(clamp01(y + dy))];
}

/**
 * The polygon's area in normalised units (shoelace formula), always positive. Comparable between
 * areas on the same map, since the scale to pixels is the same for all of them.
 */
export function polygonArea(outline: readonly Point[]): number {
  let twice = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

/**
 * Where to put the area's label: the polygon's centroid, or the average of its points if it has
 * no area (every point on a line). Works in pixels, since the centroid isn't preserved by
 * scaling the axes differently.
 */
export function labelPoint(outline: readonly Point[], size: Size): [number, number] {
  const points = outline.map((point) => toPixels(point, size));
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    twice += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(twice) < 1e-9) {
    const n = points.length || 1;
    return [
      points.reduce((sum, [x]) => sum + x, 0) / n,
      points.reduce((sum, [, y]) => sum + y, 0) / n,
    ];
  }
  return [cx / (3 * twice), cy / (3 * twice)];
}

/** The midpoint of each edge, where edge i runs from point i to the next (wrapping round). */
export function midpoints(outline: readonly Point[]): Point[] {
  return outline.map(([x1, y1], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    return [round((x1 + x2) / 2), round((y1 + y2) / 2)];
  });
}

/** An outline as an SVG `points` attribute, in pixels of the given size. */
export function svgPoints(outline: readonly Point[], size: Size): string {
  return outline.map((point) => toPixels(point, size).join(",")).join(" ");
}
