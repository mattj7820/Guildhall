import path from "node:path";
import { z } from "zod";
import type { Viewer } from "~/campaign/types";
import { encounterReducer } from "~/combat/encounter";
import { isTheirTurn, type Fight } from "~/combat/fight";
import { encounterSchema } from "~/combat/schema";
import type { Encounter } from "~/combat/types";
import type { MapId } from "~/maps/types";
import { JsonFile } from "../data/json-store";

const fileSchema = z.object({
  version: z.literal(1),
  fight: z
    .object({
      encounter: encounterSchema,
      revision: z.number().int().nonnegative(),
      map: z.string().min(1).optional(),
    })
    .optional(),
});
type FightFile = z.infer<typeof fileSchema>;

export type Saved = { fight: Fight } | { stale: Fight | undefined };

/**
 * The fight the table is in, kept in `fight.json` in the data folder so it survives reloads and
 * restarts, and so everyone can see it. There's one at a time.
 */
export class CurrentFight {
  constructor(private readonly file: JsonFile<FightFile>) {}

  static inFolder(dataPath: string): CurrentFight {
    return new CurrentFight(
      new JsonFile(path.join(dataPath, "fight.json"), fileSchema, () => ({ version: 1 })),
    );
  }

  async get(): Promise<Fight | undefined> {
    return (await this.file.read()).fight;
  }

  /**
   * The DM's tracker saves the whole encounter, saying which revision it last had. If the stored
   * fight has moved on since (another tab, or a player ending their turn), nothing is saved and the
   * newer fight comes back, so the tracker can take it up instead of writing over it.
   */
  save(encounter: Encounter, after: number, map?: MapId): Promise<Saved> {
    return this.file.update<Saved>((data) => {
      const current = data.fight?.revision ?? 0;
      if (after !== current) return { next: data, result: { stale: data.fight } };
      const fight: Fight = {
        encounter,
        revision: current + 1,
        ...((map ?? data.fight?.map) && { map: map ?? data.fight?.map }),
      };
      return { next: { ...data, fight }, result: { fight } };
    });
  }

  /** A player ends their own turn: only if it is theirs, checked against the fight as it is now. */
  endTurn(viewer: Viewer): Promise<Fight | undefined> {
    return this.file.update((data) => {
      const fight = data.fight;
      if (!fight || !isTheirTurn(fight.encounter, viewer)) return { next: data, result: undefined };
      const next: Fight = {
        ...fight,
        encounter: encounterReducer(fight.encounter, { type: "nextTurn" }),
        revision: fight.revision + 1,
      };
      return { next: { ...data, fight: next }, result: next };
    });
  }

  /** The fight is over: there's none until the next starts. */
  end(): Promise<void> {
    return this.file.update(() => ({ next: { version: 1 as const }, result: undefined }));
  }
}
