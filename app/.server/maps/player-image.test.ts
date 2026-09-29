import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyFogChange } from "~/maps/fog/changes";
import { fogGrid, hiddenMask } from "~/maps/fog/mask";
import type { FogChange, FogMask } from "~/maps/fog/types";
import type { Point } from "~/maps/types";
import { FileCache } from "../data/file-cache";
import { PlayerImages, type SourceImage } from "./player-image";

/**
 * The fixture's "Fixture Fog.png" is 1024×512: green on the left, blue on the right, and a
 * magenta square in the bottom-right corner (x 960 to 1023, y 448 to 511), the only magenta in it.
 * With 128-pixel tiles it's 8 × 4 tiles; its fog grid is 512 × 256 cells, 2 pixels each.
 */
const FIXTURE = path.resolve("tests/fixtures/vault/Maps/Fixture Fog.png");
const IMAGE = { width: 1024, height: 512 };
const TILE = 128;

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-player-image-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const images = () => new PlayerImages(new FileCache(path.join(folder, "cache")), TILE);
const source = (absolute = FIXTURE, name = "Maps/Fixture Fog.png"): SourceImage => ({
  path: name,
  absolute,
  version: "v1",
});

const rectangle = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const paint = (mode: "reveal" | "hide", points?: Point[]): FogChange => ({
  type: "paint",
  mode,
  shape: points ? { kind: "polygon", points } : { kind: "all" },
});
function fog(...changes: FogChange[]): FogMask {
  return changes.reduce(
    (mask, change) => applyFogChange(mask, change).mask,
    hiddenMask(fogGrid(IMAGE)),
  );
}

/** Everything revealed except the bottom-right corner (x from 896, y from 416), magenta and all. */
const ALL_BUT_THE_CORNER = () =>
  fog(paint("reveal"), paint("hide", rectangle(0.875, 0.8125, 1, 1)));
const LEFT_HALF = () => fog(paint("reveal", rectangle(0, 0, 0.5, 1)));

/** Every tile a player could be given, by position. */
async function everyTile(player: PlayerImages, image: SourceImage, mask: FogMask, mapId = "m") {
  const tiles = new Map<string, Buffer>();
  const playerFog = player.playerFog(mapId, { mask, version: 1 });
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) {
      const tile = await player.tile(image, playerFog, x, y);
      if (tile) tiles.set(`${x}-${y}`, tile.data);
    }
  }
  return tiles;
}

async function pixels(tile: Buffer) {
  const { data, info } = await sharp(tile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

describe("PlayerImages", () => {
  it("knows the image's real size", async () => {
    expect(await images().size(source())).toEqual(IMAGE);
  });

  it("gives players nothing of a fully fogged map", async () => {
    expect((await everyTile(images(), source(), fog())).size).toBe(0);
  });

  it("gives only the tiles a reveal reaches: whole inside it, masked at its edge", async () => {
    const tiles = await everyTile(images(), source(), LEFT_HALF());
    // Tile columns 0 to 3 cover the left half; column 3 also holds a pixel of overlap from the right.
    expect([...tiles.keys()].sort()).toEqual(
      ["0-0", "0-1", "0-2", "0-3", "1-0", "1-1", "1-2", "1-3", "2-0", "2-1", "2-2", "2-3"]
        .concat(["3-0", "3-1", "3-2", "3-3"])
        .sort(),
    );
    const whole = await pixels(tiles.get("1-1")!);
    expect(whole.data.filter((_, i) => i % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
    const edge = await pixels(tiles.get("3-1")!);
    // Its last column is in the hidden right half: transparent. Its first is fully shown.
    expect(edge.data[(10 * edge.width + edge.width - 1) * 4 + 3]).toBe(0);
    expect(edge.data[(10 * edge.width + 0) * 4 + 3]).toBe(255);
  });

  it("never lets a pixel from under the fog reach a player", async () => {
    const tiles = await everyTile(images(), source(), ALL_BUT_THE_CORNER());
    expect(tiles.has("7-3")).toBe(true); // Partly revealed: the corner's top edge.
    for (const [position, tile] of tiles) {
      const { data } = await pixels(tile);
      for (let i = 0; i < data.length; i += 4) {
        const magenta = data[i] > 180 && data[i + 1] < 90 && data[i + 2] > 180;
        if (magenta) throw new Error(`Tile ${position} has a magenta pixel`);
      }
    }
  });

  it("makes every pixel in a hidden cell fully transparent", async () => {
    const tiles = await everyTile(images(), source(), ALL_BUT_THE_CORNER());
    // Tile 7-3 covers x 896 to 1023, y 384 to 511; from y 416 down it's all hidden.
    const { data, width, height } = await pixels(tiles.get("7-3")!);
    for (let y = 416 - 384; y < height; y++) {
      for (let x = 0; x < width; x++) expect(data[(y * width + x) * 4 + 3]).toBe(0);
    }
  });

  it("sends exactly the same bytes, whatever is under the fog", async () => {
    // The same image with something else in the hidden corner.
    const { data, info } = await sharp(FIXTURE).raw().toBuffer({ resolveWithObject: true });
    for (let y = 440; y < info.height; y++) {
      for (let x = 900; x < info.width; x++) data.set([255, 255, 0], (y * info.width + x) * 3);
    }
    const altered = path.join(folder, "altered.png");
    await writeFile(altered, await sharp(data, { raw: info }).png().toBuffer());

    const player = images();
    const original = await everyTile(player, source(), ALL_BUT_THE_CORNER(), "one");
    const changed = await everyTile(
      player,
      source(altered, "Maps/Other.png"),
      ALL_BUT_THE_CORNER(),
      "two",
    );
    expect([...changed.keys()]).toEqual([...original.keys()]);
    for (const [position, tile] of original) {
      expect(changed.get(position)?.equals(tile), `tile ${position}`).toBe(true);
    }
  });

  it("follows the fog as it is now: a tile hidden again is no longer given", async () => {
    const player = images();
    const image = source();
    const revealed = player.playerFog("m", { mask: LEFT_HALF(), version: 1 });
    expect(await player.tile(image, revealed, 0, 0)).toBeDefined();
    const hiddenAgain = player.playerFog("m", { mask: fog(), version: 2 });
    expect(await player.tile(image, hiddenAgain, 0, 0)).toBeUndefined();
  });

  it.each([
    [8, 0],
    [0, 4],
    [-1, 0],
    [0.5, 0],
  ])("gives nothing for a tile that isn't on the image: %s, %s", async (x, y) => {
    const player = images();
    const everything = player.playerFog("m", { mask: fog(paint("reveal")), version: 1 });
    expect(await player.tile(source(), everything, x, y)).toBeUndefined();
  });
});
