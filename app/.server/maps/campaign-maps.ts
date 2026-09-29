import path from "node:path";
import { z } from "zod";
import type { EntityId, Visibility } from "~/campaign/types";
import { campaignMapSchema, MAP_NAME_MAX } from "~/maps/schema";
import { treeProblem, withoutMissingLinks } from "~/maps/tree";
import type { CampaignMap, MapChanges, MapId, MapImage } from "~/maps/types";
import { newId } from "~/shared/ids";
import { JsonFile } from "../data/json-store";

const currentFile = z.object({
  version: z.literal(2),
  maps: z.array(campaignMapSchema),
});
type MapsFile = z.infer<typeof currentFile>;

/**
 * Version 1 had no way to share a map, so its areas were all `dm` without meaning anything by it.
 * From version 2 an area on a shared map is shown once it's revealed, unless it's `dm` (secret),
 * so version 1's areas become `players`. Safe, since all of its maps were DM-only.
 */
const fileSchema: z.ZodType<MapsFile> = z.union([
  currentFile,
  z
    .object({ version: z.literal(1), maps: z.array(campaignMapSchema) })
    .transform(({ maps }): MapsFile => ({
      version: 2,
      maps: maps.map((map) => ({
        ...map,
        areas: map.areas.map((area) => ({ ...area, visibility: "players" })),
      })),
    })),
]);

export const DEFAULT_MAP_NAME = "Untitled map";

export interface NewMap {
  name?: string;
  image: MapImage;
  note?: EntityId;
}

/** A save either succeeds or is refused because the maps would no longer form a tree. */
export type MapUpdate = { map: CampaignMap } | { problem: string };

/**
 * Interactive maps and their areas, kept in `maps.json` in the data folder. Every method goes to
 * the file, so it survives reloads and server restarts. Changes that would give a map two parents,
 * or put a map inside itself, are refused inside the write, so two tabs can't race past the check.
 */
export class CampaignMaps {
  constructor(
    private readonly file: JsonFile<MapsFile>,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = newId,
  ) {}

  /** The clock and IDs can be replaced in tests. */
  static inFolder(
    dataPath: string,
    options: { now?: () => Date; createId?: () => string } = {},
  ): CampaignMaps {
    return new CampaignMaps(
      new JsonFile(path.join(dataPath, "maps.json"), fileSchema, () => ({ version: 2, maps: [] })),
      options.now,
      options.createId,
    );
  }

  /** Sorted by name. */
  async list(): Promise<CampaignMap[]> {
    const { maps } = await this.file.read();
    return [...maps].sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: MapId): Promise<CampaignMap | undefined> {
    return (await this.file.read()).maps.find((map) => map.id === id);
  }

  /** Maps that illustrate the given note. */
  async forNote(noteId: EntityId): Promise<CampaignMap[]> {
    return (await this.list()).filter((map) => map.note === noteId);
  }

  async create({ name, image, note }: NewMap): Promise<CampaignMap> {
    const timestamp = this.now().toISOString();
    const map: CampaignMap = {
      id: this.createId(),
      name: cleanName(name),
      image,
      ...(note ? { note } : {}),
      visibility: "dm",
      areas: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.file.update((data) => ({
      next: { ...data, maps: [...data.maps, map] },
      result: map,
    }));
  }

  /**
   * Saves the editor's changes. Links to maps deleted in the meantime (perhaps in another tab) are
   * dropped rather than refused, so a stale editor can't block every later save. Undefined if the
   * map itself no longer exists.
   */
  update(id: MapId, changes: MapChanges): Promise<MapUpdate | undefined> {
    return this.file.update<MapUpdate | undefined>((data) => {
      const existing = data.maps.find((map) => map.id === id);
      if (!existing) return { next: data, result: undefined };

      const exists = (mapId: MapId) => data.maps.some((map) => map.id === mapId);
      const { note, ...rest } = changes;
      const changed: CampaignMap = {
        ...existing,
        ...rest,
        name: cleanName(changes.name),
        areas: withoutMissingLinks(changes.areas, exists),
        updatedAt: this.now().toISOString(),
      };
      if (note) changed.note = note;
      else delete changed.note;

      const maps = data.maps.map((map) => (map.id === id ? changed : map));
      const problem = treeProblem(maps);
      if (problem) return { next: data, result: { problem } };
      return { next: { ...data, maps }, result: { map: changed } };
    });
  }

  /** Records a new location or size for the image, keeping the areas as they are. */
  setImage(id: MapId, image: MapImage): Promise<CampaignMap | undefined> {
    return this.change(id, (map) => ({ ...map, image }));
  }

  /** Shares the map with players, or makes it DM-only again. Undefined if it no longer exists. */
  setVisibility(id: MapId, visibility: Visibility): Promise<CampaignMap | undefined> {
    return this.change(id, (map) => ({ ...map, visibility }));
  }

  /**
   * False if there was nothing to delete. Areas that led to the map become not mapped yet, and its
   * own child maps become top-level maps.
   */
  delete(id: MapId): Promise<boolean> {
    return this.file.update((data) => {
      const remaining = data.maps.filter((map) => map.id !== id);
      if (remaining.length === data.maps.length) return { next: data, result: false };
      const maps = remaining.map((map) =>
        map.areas.some((area) => area.map === id)
          ? { ...map, areas: withoutMissingLinks(map.areas, (mapId) => mapId !== id) }
          : map,
      );
      return { next: { ...data, maps }, result: true };
    });
  }

  /** Changes one map, recording when. Undefined if it no longer exists. */
  private change(
    id: MapId,
    update: (map: CampaignMap) => CampaignMap,
  ): Promise<CampaignMap | undefined> {
    return this.file.update((data) => {
      const existing = data.maps.find((map) => map.id === id);
      if (!existing) return { next: data, result: undefined };
      const changed = { ...update(existing), updatedAt: this.now().toISOString() };
      return {
        next: { ...data, maps: data.maps.map((map) => (map.id === id ? changed : map)) },
        result: changed,
      };
    });
  }
}

function cleanName(name: string | undefined): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ").slice(0, MAP_NAME_MAX);
  return trimmed || DEFAULT_MAP_NAME;
}
