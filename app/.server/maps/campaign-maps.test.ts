import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { idSequence } from "~/combat/test-builders";
import { buildArea, SQUARE } from "~/maps/test-builders";
import type { CampaignMap, MapChanges } from "~/maps/types";
import { DataFileError } from "../data/json-store";
import { CampaignMaps, DEFAULT_MAP_NAME } from "./campaign-maps";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-maps-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** A store with a controllable clock and predictable IDs. */
function store() {
  let minute = 0;
  const now = () => new Date(Date.UTC(2026, 8, 27, 10, minute++));
  return CampaignMaps.inFolder(folder, { now, createId: idSequence("map") });
}

const WORLD_IMAGE = { path: "Maps/Fixture World.png", width: 400, height: 200 };
const TOWN_IMAGE = { path: "Maps/Fixture Town.png", width: 200, height: 200 };

/** The editor's save body for a map, with the given areas. */
const changes = (map: CampaignMap, fields: Partial<MapChanges> = {}): MapChanges => ({
  name: map.name,
  image: map.image,
  areas: map.areas,
  ...(map.note ? { note: map.note } : {}),
  ...fields,
});

describe("CampaignMaps", () => {
  it("starts empty", async () => {
    expect(await store().list()).toEqual([]);
  });

  it("creates a DM-only map with no areas", async () => {
    const created = await store().create({ image: WORLD_IMAGE, note: "location-world" });
    expect(created).toEqual({
      id: "map-1",
      name: DEFAULT_MAP_NAME,
      image: WORLD_IMAGE,
      note: "location-world",
      visibility: "dm",
      areas: [],
      createdAt: "2026-09-27T10:00:00.000Z",
      updatedAt: "2026-09-27T10:00:00.000Z",
    });
  });

  it("keeps maps in the data folder, so they survive a restart", async () => {
    const { id } = await store().create({ name: "World", image: WORLD_IMAGE });
    expect(await CampaignMaps.inFolder(folder).get(id)).toMatchObject({ name: "World" });
    const onDisk = JSON.parse(await readFile(path.join(folder, "maps.json"), "utf8"));
    expect(onDisk).toMatchObject({ version: 1, maps: [{ name: "World" }] });
  });

  it("lists maps by name", async () => {
    const maps = store();
    await maps.create({ name: "Town", image: TOWN_IMAGE });
    await maps.create({ name: "castle", image: TOWN_IMAGE });
    await maps.create({ name: "World", image: WORLD_IMAGE });
    expect((await maps.list()).map((map) => map.name)).toEqual(["castle", "Town", "World"]);
  });

  it("saves the editor's changes, and when they were made", async () => {
    const maps = store();
    const map = await maps.create({ name: "World", image: WORLD_IMAGE, note: "old-note" });
    const area = buildArea({ id: "a1", name: "Harbour", note: "location-harbour" });
    const result = await maps.update(
      map.id,
      changes(map, { name: "  The   World ", areas: [area], note: undefined }),
    );
    expect(result).toEqual({
      map: {
        ...map,
        name: "The World",
        note: undefined,
        areas: [area],
        updatedAt: "2026-09-27T10:01:00.000Z",
      },
    });
    const saved = await maps.get(map.id);
    expect(saved && "note" in saved).toBe(false);
  });

  it("links an area to another map", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const town = await maps.create({ name: "Town", image: TOWN_IMAGE });
    const area = buildArea({ id: "a1", map: town.id });
    await maps.update(world.id, changes(world, { areas: [area] }));
    expect((await maps.get(world.id))?.areas[0].map).toBe(town.id);
  });

  it("refuses a second way into a map and leaves the file unchanged", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const town = await maps.create({ name: "Town", image: TOWN_IMAGE });
    await maps.update(world.id, changes(world, { areas: [buildArea({ id: "a1", map: town.id })] }));
    const before = await readFile(path.join(folder, "maps.json"), "utf8");

    const second = buildArea({ id: "a2", name: "Shortcut", map: town.id });
    const result = await maps.update(
      world.id,
      changes(world, { areas: [buildArea({ id: "a1", map: town.id }), second] }),
    );
    expect(result).toEqual({ problem: "“Town” is already reached from “a1”." });
    expect(await readFile(path.join(folder, "maps.json"), "utf8")).toBe(before);
  });

  it("refuses to put a map inside its own child", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const town = await maps.create({ name: "Town", image: TOWN_IMAGE });
    await maps.update(world.id, changes(world, { areas: [buildArea({ id: "a1", map: town.id })] }));
    const result = await maps.update(
      town.id,
      changes(town, { areas: [buildArea({ id: "a2", map: world.id })] }),
    );
    expect(result).toMatchObject({ problem: expect.stringMatching(/inside itself/) });
  });

  it("drops links to maps deleted in another tab instead of refusing the save", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const result = await maps.update(
      world.id,
      changes(world, { areas: [buildArea({ id: "a1", map: "deleted-map", note: "n" })] }),
    );
    expect(result).toMatchObject({ map: { areas: [{ id: "a1", note: "n" }] } });
    expect((await maps.get(world.id))?.areas[0].map).toBeUndefined();
  });

  it("records a new image location or size without touching the areas", async () => {
    const maps = store();
    const map = await maps.create({ name: "World", image: WORLD_IMAGE });
    await maps.update(map.id, changes(map, { areas: [buildArea({ id: "a1" })] }));
    const moved = { path: "Elsewhere/Fixture World.png", width: 800, height: 400 };
    const updated = await maps.setImage(map.id, moved);
    expect(updated?.image).toEqual(moved);
    expect(updated?.areas[0].outline).toEqual(SQUARE);
  });

  it("finds the maps that illustrate a note", async () => {
    const maps = store();
    await maps.create({ name: "World", image: WORLD_IMAGE, note: "location-world" });
    await maps.create({ name: "Town", image: TOWN_IMAGE, note: "location-town" });
    expect((await maps.forNote("location-town")).map((map) => map.name)).toEqual(["Town"]);
  });

  it("deletes a map, and areas that led to it become not mapped yet", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const town = await maps.create({ name: "Town", image: TOWN_IMAGE });
    const keep = await maps.create({ name: "Keep", image: TOWN_IMAGE });
    await maps.update(world.id, changes(world, { areas: [buildArea({ id: "a1", map: town.id })] }));
    await maps.update(town.id, changes(town, { areas: [buildArea({ id: "a2", map: keep.id })] }));

    expect(await maps.delete(town.id)).toBe(true);
    expect((await maps.list()).map((map) => map.name)).toEqual(["Keep", "World"]);
    expect((await maps.get(world.id))?.areas[0]).toEqual(buildArea({ id: "a1" }));
    expect(await maps.delete(town.id)).toBe(false);
  });

  it("returns undefined for maps that don't exist", async () => {
    const maps = store();
    expect(await maps.get("nope")).toBeUndefined();
    expect(await maps.update("nope", { name: "x", image: WORLD_IMAGE, areas: [] })).toBeUndefined();
    expect(await maps.setImage("nope", WORLD_IMAGE)).toBeUndefined();
  });

  it("keeps simultaneous saves from different tabs", async () => {
    const maps = store();
    const world = await maps.create({ name: "World", image: WORLD_IMAGE });
    const town = await maps.create({ name: "Town", image: TOWN_IMAGE });
    await Promise.all([
      maps.update(world.id, changes(world, { areas: [buildArea({ id: "a1" })] })),
      maps.update(town.id, changes(town, { areas: [buildArea({ id: "a2" })] })),
    ]);
    expect((await maps.get(world.id))?.areas).toHaveLength(1);
    expect((await maps.get(town.id))?.areas).toHaveLength(1);
  });

  it("reports a damaged file instead of overwriting it", async () => {
    const filePath = path.join(folder, "maps.json");
    const damaged = '{"version": 1, "maps": [{"name": 3}]}';
    await writeFile(filePath, damaged);
    await expect(store().list()).rejects.toThrow(DataFileError);
    await expect(store().create({ image: WORLD_IMAGE })).rejects.toThrow(DataFileError);
    expect(await readFile(filePath, "utf8")).toBe(damaged);
  });
});
