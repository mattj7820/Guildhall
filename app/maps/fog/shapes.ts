/**
 * Which cells a shape covers: those whose centre is inside it. Worked out in cell units, where a
 * cell is 1×1, so a brush is round on the image whatever its shape.
 */
import type { Point } from "../types";
import type { FogGrid, FogShape } from "./types";

type Vector = [number, number];

/** Cell indexes, ascending and distinct. */
export function cellsIn(grid: FogGrid, shape: FogShape): number[] {
  switch (shape.kind) {
    case "all":
      return Array.from({ length: grid.cols * grid.rows }, (_, index) => index);
    case "polygon":
      return cellsInPolygon(grid, shape.points);
    case "stroke":
      return cellsInStroke(grid, shape.points, shape.radius);
  }
}

/**
 * The cells whose centre is inside the polygon (even-odd, so a self-crossing outline behaves as
 * drawn), filled row by row. A polygon too small to hold any cell's centre still covers the cell
 * under its middle, so even a tiny area can be revealed.
 */
export function cellsInPolygon(grid: FogGrid, outline: readonly Point[]): number[] {
  if (outline.length === 0) return [];
  const polygon = outline.map((point) => toCells(point, grid));
  const cells: number[] = [];
  const ys = polygon.map(([, y]) => y);
  const firstRow = Math.max(0, Math.floor(Math.min(...ys)));
  const lastRow = Math.min(grid.rows - 1, Math.floor(Math.max(...ys)));
  for (let row = firstRow; row <= lastRow; row++) {
    const y = row + 0.5;
    const crossings: number[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (yi > y !== yj > y) crossings.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      // Columns whose centre (col + 0.5) lies between the two crossings.
      const firstCol = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const lastCol = Math.min(grid.cols - 1, Math.ceil(crossings[k + 1] - 0.5) - 1);
      for (let col = firstCol; col <= lastCol; col++) cells.push(row * grid.cols + col);
    }
  }
  return cells.length > 0 ? cells : [cellAt(grid, average(polygon))];
}

/**
 * The cells within `radius` (a fraction of the longer side) of the stroke's path. Each segment
 * looks only at the cells near it, so a long stroke across the map stays quick.
 */
export function cellsInStroke(grid: FogGrid, points: readonly Point[], radius: number): number[] {
  if (points.length === 0) return [];
  const path = points.map((point) => toCells(point, grid));
  // Never narrower than a cell, so the cell under the pointer is always painted.
  const reach = Math.max(radius * Math.max(grid.cols, grid.rows), Math.SQRT1_2);
  const covered = new Uint8Array(grid.cols * grid.rows);
  path.forEach((to, index) => {
    const from = path[Math.max(0, index - 1)];
    const firstCol = Math.max(0, Math.floor(Math.min(from[0], to[0]) - reach));
    const lastCol = Math.min(grid.cols - 1, Math.floor(Math.max(from[0], to[0]) + reach));
    const firstRow = Math.max(0, Math.floor(Math.min(from[1], to[1]) - reach));
    const lastRow = Math.min(grid.rows - 1, Math.floor(Math.max(from[1], to[1]) + reach));
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const index = row * grid.cols + col;
        if (!covered[index] && distanceToSegment(col + 0.5, row + 0.5, from, to) <= reach) {
          covered[index] = 1;
        }
      }
    }
  });
  const cells: number[] = [];
  covered.forEach((cell, index) => {
    if (cell) cells.push(index);
  });
  return cells;
}

function toCells([x, y]: Point, grid: FogGrid): Vector {
  return [x * grid.cols, y * grid.rows];
}

function cellAt(grid: FogGrid, [x, y]: Vector): number {
  const col = Math.min(grid.cols - 1, Math.max(0, Math.floor(x)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(y)));
  return row * grid.cols + col;
}

function distanceToSegment(x: number, y: number, [ax, ay]: Vector, [bx, by]: Vector): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function average(points: readonly Vector[]): Vector {
  const sum = points.reduce<Vector>(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}
