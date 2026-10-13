import path from "node:path";
import { z } from "zod";
import { applyFogChange } from "~/maps/fog/changes";
import { decodeCells, encodeCells, fogGrid, hiddenMask } from "~/maps/fog/mask";
import type { FogChange, FogMask } from "~/maps/fog/types";
import type { MapId, Size } from "~/maps/types";
import { JsonFile } from "../data/json-store";

const storedFogSchema = z
  .object({
    cols: z.number().int().positive().max(4096),
    rows: z.number().int().positive().max(4096),
    cells: z.string(),
    /** Goes up by one with every change, so a poll can tell whether anything changed. */
    version: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime(),
  })
  .refine((fog) => decodeCells(fog.cells, fog.cols * fog.rows) !== undefined, {
    message: "A fog's cells don't match its grid",
  });
type StoredFog = z.infer<typeof storedFogSchema>;

const fileSchema = z.object({
  version: z.literal(1),
  fogs: z.record(z.string(), storedFogSchema),
});
type FogsFile = z.infer<typeof fileSchema>;

/** A map's fog as stored now. */
export interface MapFog {
  mask: FogMask;
  version: number;
}

/**
 * Each map's fog of war, kept in `fog.json` in the data folder, apart from `maps.json`: fog changes
 * often during a session, and this keeps those writes (and players' polling) away from the map
 * editor's autosave. A map without stored fog is fully fogged, on a grid made for its image.
 */
export class MapFogs {
  constructor(
    private readonly file: JsonFile<FogsFile>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The clock can be replaced in tests. */
  static inFolder(dataPath: string, options: { now?: () => Date } = {}): MapFogs {
    return new MapFogs(
      new JsonFile(path.join(dataPath, "fog.json"), fileSchema, () => ({ version: 1, fogs: {} })),
      options.now,
    );
  }

  /** `image` is the size the map's areas were drawn against, for a map with no fog yet. */
  async get(mapId: MapId, image: Size): Promise<MapFog> {
    return toMapFog((await this.file.read()).fogs[mapId], image);
  }

  /** Several maps' fog from one read of the file, by map. */
  async getMany(maps: readonly { id: MapId; image: Size }[]): Promise<Map<MapId, MapFog>> {
    const { fogs } = await this.file.read();
    return new Map(maps.map((map) => [map.id, toMapFog(fogs[map.id], map.image)]));
  }

  /**
   * Applies the changes in order to the fog as stored now (decision 30: whoever else changed it
   * meanwhile keeps their change). The version goes up only if a cell actually changed.
   */
  apply(mapId: MapId, image: Size, changes: readonly FogChange[]): Promise<MapFog> {
    return this.file.update((data) => {
      const current = toMapFog(data.fogs[mapId], image);
      let mask = current.mask;
      for (const change of changes) mask = applyFogChange(mask, change).mask;
      if (mask === current.mask) return { next: data, result: current };

      const version = current.version + 1;
      const stored: StoredFog = {
        cols: mask.cols,
        rows: mask.rows,
        cells: encodeCells(mask.cells),
        version,
        updatedAt: this.now().toISOString(),
      };
      return {
        next: { ...data, fogs: { ...data.fogs, [mapId]: stored } },
        result: { mask, version },
      };
    });
  }

  /** When a map is deleted. */
  delete(mapId: MapId): Promise<void> {
    return this.file.update((data) => {
      if (!(mapId in data.fogs)) return { next: data, result: undefined };
      const fogs = Object.fromEntries(Object.entries(data.fogs).filter(([id]) => id !== mapId));
      return { next: { ...data, fogs }, result: undefined };
    });
  }
}

function toMapFog(stored: StoredFog | undefined, image: Size): MapFog {
  if (!stored) return { mask: hiddenMask(fogGrid(image)), version: 0 };
  // The schema has already checked that the cells decode.
  const cells = decodeCells(stored.cells, stored.cols * stored.rows)!;
  return { mask: { cols: stored.cols, rows: stored.rows, cells }, version: stored.version };
}
