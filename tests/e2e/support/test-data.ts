import { randomUUID } from "node:crypto";

/** Guildhall's own address in the e2e run, for posts that must look like they came from it. */
export const ORIGIN = "http://localhost:4173";

/**
 * A name no other test uses, since tests share the server's data folder. Random rather than from
 * the test's ID, which repeats and retries share.
 */
export function uniqueName(base: string) {
  const name = `${base} ${randomUUID().slice(0, 8)}`;
  namesMade.add(name);
  return name;
}

/**
 * The unique names made since the last tidy-up (see `tidyBags`). Each worker runs its tests one
 * at a time, so these are the current test's.
 */
export const namesMade = new Set<string>();

/** A point on an image, as fractions of its width and height. */
export type Point = [number, number];

export interface FixtureImage {
  file: string;
  width: number;
  height: number;
}

/** The fixture vault's map images (placeholders, described in `Maps/Fixture Maps.md`). */
export const IMAGES = {
  /** 1024×512 in two 512-pixel tiles, with a magenta square in its bottom-right corner. */
  fog: { file: "Fixture Fog.png", width: 1024, height: 512 },
  /** 400×200: deliberately not square. */
  world: { file: "Fixture World.png", width: 400, height: 200 },
  town: { file: "Fixture Town.png", width: 200, height: 200 },
} satisfies Record<string, FixtureImage>;

/** A map made for a test: its ID, page address and name, and the image it was made from. */
export interface MapRef {
  id: string;
  url: string;
  name: string;
  image: FixtureImage;
}

/* Fog changes, as the DM's fog endpoint takes them. */

export type FogChange = { type: "paint"; mode: "reveal" | "hide"; shape: object };

export const REVEAL_ALL: FogChange = { type: "paint", mode: "reveal", shape: { kind: "all" } };
export const HIDE_ALL: FogChange = { type: "paint", mode: "hide", shape: { kind: "all" } };

/** Reveals or hides a rectangle, from its top-left to its bottom-right corner. */
export function fogRect(mode: "reveal" | "hide", [x0, y0]: Point, [x1, y1]: Point): FogChange {
  const points = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return { type: "paint", mode, shape: { kind: "polygon", points } };
}

/** The corners of a rectangle, for drawing an area. */
export const rectangle = ([x0, y0]: Point, [x1, y1]: Point): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A battle grid of 64-pixel squares on the fog fixture: 16 × 8. */
export const SQUARES_64 = { square: 0.0625, origin: [0, 0], lines: 0.4 };
