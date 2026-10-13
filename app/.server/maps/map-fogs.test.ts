import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { revealedCount } from "~/maps/fog/mask";
import type { FogChange } from "~/maps/fog/types";
import type { Point } from "~/maps/types";
import { DataFileError } from "../data/json-store";
import { MapFogs } from "./map-fogs";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-fog-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

function store() {
  let minute = 0;
  return MapFogs.inFolder(folder, { now: () => new Date(Date.UTC(2026, 8, 29, 10, minute++)) });
}

/** A 400×200 image: a 512×256 grid. */
const WORLD = { width: 400, height: 200 };

const half = (from: number, to: number): Point[] => [
  [from, 0],
  [to, 0],
  [to, 1],
  [from, 1],
];
const reveal = (points: Point[]): FogChange => ({
  type: "paint",
  mode: "reveal",
  shape: { kind: "polygon", points },
});
const revealAll: FogChange = { type: "paint", mode: "reveal", shape: { kind: "all" } };

describe("MapFogs", () => {
  it("fogs a map completely until something is revealed, on a grid for its image", async () => {
    const { mask, version } = await store().get("world", WORLD);
    expect({ cols: mask.cols, rows: mask.rows }).toEqual({ cols: 512, rows: 256 });
    expect(revealedCount(mask)).toBe(0);
    expect(version).toBe(0);
  });

  it("gives several maps' fog at once, each as get would", async () => {
    const fogs = store();
    await fogs.apply("world", WORLD, [revealAll]);
    const many = await fogs.getMany([
      { id: "world", image: WORLD },
      { id: "town", image: { width: 200, height: 200 } },
    ]);
    expect(many.get("world")).toEqual(await fogs.get("world", WORLD));
    expect(many.get("town")).toEqual(await fogs.get("town", { width: 200, height: 200 }));
  });

  it("keeps reveals in the data folder, so they survive a restart", async () => {
    await store().apply("world", WORLD, [reveal(half(0, 0.5))]);
    const { mask, version } = await MapFogs.inFolder(folder).get("world", WORLD);
    expect(revealedCount(mask)).toBe(256 * 256);
    expect(version).toBe(1);

    const onDisk = JSON.parse(await readFile(path.join(folder, "fog.json"), "utf8"));
    expect(onDisk).toEqual({
      version: 1,
      fogs: {
        world: {
          cols: 512,
          rows: 256,
          cells: expect.any(String),
          version: 1,
          updatedAt: "2026-09-29T10:00:00.000Z",
        },
      },
    });
    // Run lengths keep it small: one run in and one out per row.
    expect(onDisk.fogs.world.cells.length).toBeLessThan(2000);
  });

  it("applies a batch of changes in order, as one new version", async () => {
    const hideAll: FogChange = { type: "paint", mode: "hide", shape: { kind: "all" } };
    const fog = await store().apply("world", WORLD, [revealAll, hideAll, reveal(half(0.5, 1))]);
    expect(revealedCount(fog.mask)).toBe(256 * 256);
    expect(fog.version).toBe(1);
  });

  it("keeps the version when nothing actually changed", async () => {
    const fogs = store();
    await fogs.apply("world", WORLD, [revealAll]);
    expect((await fogs.apply("world", WORLD, [revealAll])).version).toBe(1);
  });

  it("keeps both of two changes sent at the same moment", async () => {
    const fogs = store();
    await Promise.all([
      fogs.apply("world", WORLD, [reveal(half(0, 0.5))]),
      fogs.apply("world", WORLD, [reveal(half(0.5, 1))]),
    ]);
    const { mask, version } = await fogs.get("world", WORLD);
    expect(revealedCount(mask)).toBe(512 * 256);
    expect(version).toBe(2);
  });

  it("keeps each map's fog apart", async () => {
    const fogs = store();
    await fogs.apply("world", WORLD, [revealAll]);
    expect(revealedCount((await fogs.get("town", WORLD)).mask)).toBe(0);
  });

  it("keeps a map's grid when its image is later recorded at another size", async () => {
    const fogs = store();
    await fogs.apply("world", WORLD, [revealAll]);
    const { mask } = await fogs.get("world", { width: 300, height: 300 });
    expect({ cols: mask.cols, rows: mask.rows }).toEqual({ cols: 512, rows: 256 });
  });

  it("forgets a deleted map's fog", async () => {
    const fogs = store();
    await fogs.apply("world", WORLD, [revealAll]);
    await fogs.delete("world");
    expect((await fogs.get("world", WORLD)).version).toBe(0);
  });

  it("refuses, without overwriting, a file whose cells don't match their grid", async () => {
    const damaged = JSON.stringify({
      version: 1,
      fogs: {
        world: { cols: 4, rows: 2, cells: "3", version: 1, updatedAt: "2026-09-29T10:00:00.000Z" },
      },
    });
    await writeFile(path.join(folder, "fog.json"), damaged);
    await expect(store().apply("world", WORLD, [revealAll])).rejects.toThrow(DataFileError);
    expect(await readFile(path.join(folder, "fog.json"), "utf8")).toBe(damaged);
  });
});
