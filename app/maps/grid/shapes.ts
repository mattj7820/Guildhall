/**
 * Spell areas on a battle map: the sphere, cube, cone and line that spell descriptions use, and
 * which squares they cover. A square is covered when its centre is inside the shape, the same
 * "centre" rule as painting the fog: simple to reason about at the table. Isomorphic and pure,
 * in image pixels.
 */
import { FEET_PER_SQUARE, squareAt, squareCentre, type PixelGrid } from "./grid";

export const SPELL_SHAPES = ["sphere", "cube", "cone", "line"] as const;
export type SpellShape = (typeof SPELL_SHAPES)[number];

/** The sizes spells most often give, in feet. */
export const COMMON_SPELL_SIZES = [10, 15, 20, 30, 60] as const;

type Pixels = readonly [number, number];

export interface SpellArea {
  shape: SpellShape;
  /** A sphere's radius, a cube's side, a cone's or line's length. */
  feet: number;
  /** Where it starts: a sphere's centre, the middle of a cube's near face, a cone's point. */
  origin: Pixels;
  /** A point it's aimed towards (a sphere ignores it). */
  aim: Pixels;
}

/** Whether an image point is inside the area. */
export function insideArea(grid: PixelGrid, area: SpellArea, [px, py]: Pixels): boolean {
  const length = (area.feet / FEET_PER_SQUARE) * grid.square;
  const [ox, oy] = area.origin;
  const dx = area.aim[0] - ox;
  const dy = area.aim[1] - oy;
  const aim = Math.hypot(dx, dy) || 1;
  // No aim yet (a click without a drag) points right.
  const [ux, uy] = aim === 1 && dx === 0 && dy === 0 ? [1, 0] : [dx / aim, dy / aim];
  const along = (px - ox) * ux + (py - oy) * uy;
  const across = Math.abs((py - oy) * ux - (px - ox) * uy);
  switch (area.shape) {
    case "sphere":
      return Math.hypot(px - ox, py - oy) <= length;
    case "cone":
      // As wide as it is far from its point.
      return along >= 0 && along <= length && across <= along / 2;
    case "line":
      // 5 ft wide.
      return along >= 0 && along <= length && across <= grid.square / 2;
    case "cube": {
      // Square to the grid, extending the way it's mostly aimed.
      const { a, b, sign } = cubeAxes(dx, dy, px - ox, py - oy);
      return a * sign >= 0 && a * sign <= length && Math.abs(b) <= length / 2;
    }
  }
}

function cubeAxes(dx: number, dy: number, x: number, y: number) {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const sign = (horizontal ? Math.sign(dx) : Math.sign(dy)) || 1;
  return horizontal ? { a: x, b: y, sign } : { a: y, b: x, sign };
}

/** The squares the area covers, as columns and rows, row by row. */
export function coveredSquares(grid: PixelGrid, area: SpellArea): [number, number][] {
  const length = (area.feet / FEET_PER_SQUARE) * grid.square;
  // Nothing reaches further from its origin than a cube's far corner.
  const reach = length * Math.SQRT2 + grid.square;
  const [c0, r0] = squareAt(grid, [area.origin[0] - reach, area.origin[1] - reach]);
  const [c1, r1] = squareAt(grid, [area.origin[0] + reach, area.origin[1] + reach]);
  const covered: [number, number][] = [];
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (insideArea(grid, area, squareCentre(grid, [col, row]))) covered.push([col, row]);
    }
  }
  return covered;
}

/** The area's own shape, as an SVG path in image pixels, to draw over the squares it covers. */
export function areaPath(grid: PixelGrid, area: SpellArea): string {
  const length = (area.feet / FEET_PER_SQUARE) * grid.square;
  const [ox, oy] = area.origin;
  const dx = area.aim[0] - ox;
  const dy = area.aim[1] - oy;
  const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
  const at = (distance: number, turn: number) =>
    `${ox + Math.cos(angle + turn) * distance},${oy + Math.sin(angle + turn) * distance}`;
  switch (area.shape) {
    case "sphere":
      return `M${ox - length},${oy}a${length},${length} 0 1 0 ${2 * length},0a${length},${length} 0 1 0 ${-2 * length},0Z`;
    case "cone": {
      const half = Math.atan(0.5);
      const side = length / Math.cos(half);
      return `M${ox},${oy}L${at(side, -half)}L${at(side, half)}Z`;
    }
    case "line": {
      const w = grid.square / 2;
      const side = Math.atan2(w, length);
      const far = Math.hypot(length, w);
      return `M${at(w, -Math.PI / 2)}L${at(far, -side)}L${at(far, side)}L${at(w, Math.PI / 2)}Z`;
    }
    case "cube": {
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const sign = (horizontal ? Math.sign(dx) : Math.sign(dy)) || 1;
      const x = horizontal ? (sign > 0 ? ox : ox - length) : ox - length / 2;
      const y = horizontal ? oy - length / 2 : sign > 0 ? oy : oy - length;
      return `M${x},${y}h${length}v${length}h${-length}Z`;
    }
  }
}

/** A token as far as spell areas care: where its centre is, and how many squares across. */
export interface Occupant {
  id: string;
  at: Pixels;
  size: number;
}

/** The tokens with at least one of their squares in the area. */
export function caughtIn(
  grid: PixelGrid,
  squares: readonly [number, number][],
  tokens: readonly Occupant[],
): string[] {
  const covered = new Set(squares.map(([col, row]) => `${col},${row}`));
  return tokens
    .filter((token) => {
      const offset = ((token.size - 1) * grid.square) / 2;
      const [c0, r0] = squareAt(grid, [token.at[0] - offset, token.at[1] - offset]);
      for (let row = r0; row < r0 + token.size; row++) {
        for (let col = c0; col < c0 + token.size; col++) {
          if (covered.has(`${col},${row}`)) return true;
        }
      }
      return false;
    })
    .map((token) => token.id);
}
