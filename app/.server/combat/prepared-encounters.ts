import path from "node:path";
import { z } from "zod";
import { createEncounter } from "~/combat/encounter";
import { newId } from "~/shared/ids";
import { PREPARED_NAME_MAX, preparedEncounterSchema } from "~/combat/schema";
import type { Encounter, PreparedEncounter, PreparedPlacement } from "~/combat/types";
import { JsonFile } from "../data/json-store";

const fileSchema = z.object({
  version: z.literal(1),
  encounters: z.array(preparedEncounterSchema),
});
type PreparedFile = z.infer<typeof fileSchema>;

export const DEFAULT_PREPARED_NAME = "Untitled encounter";

export interface PreparedChanges {
  name?: string;
  notes?: string;
  encounter?: Encounter;
  placement?: PreparedPlacement;
}

/**
 * Combat encounters prepared before a session, kept in `prepared-encounters.json` in the data
 * folder. Every method goes to the file, so it survives reloads and server restarts.
 */
export class PreparedEncounters {
  constructor(
    private readonly file: JsonFile<PreparedFile>,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = newId,
  ) {}

  /** The clock and IDs can be replaced in tests. */
  static inFolder(
    dataPath: string,
    options: { now?: () => Date; createId?: () => string } = {},
  ): PreparedEncounters {
    return new PreparedEncounters(
      new JsonFile(path.join(dataPath, "prepared-encounters.json"), fileSchema, () => ({
        version: 1,
        encounters: [],
      })),
      options.now,
      options.createId,
    );
  }

  /** Most recently edited first. */
  async list(): Promise<PreparedEncounter[]> {
    const { encounters } = await this.file.read();
    return [...encounters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<PreparedEncounter | undefined> {
    return (await this.file.read()).encounters.find((prepared) => prepared.id === id);
  }

  async create(changes: PreparedChanges = {}): Promise<PreparedEncounter> {
    const timestamp = this.now().toISOString();
    const prepared: PreparedEncounter = {
      id: this.createId(),
      name: cleanName(changes.name),
      notes: changes.notes ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
      encounter: changes.encounter ?? createEncounter(this.createId()),
      ...(changes.placement && { placement: changes.placement }),
    };
    return this.file.update((data) => ({
      next: { ...data, encounters: [...data.encounters, prepared] },
      result: prepared,
    }));
  }

  /** Undefined if there's no such encounter (it may have been deleted in another tab). */
  update(id: string, changes: PreparedChanges): Promise<PreparedEncounter | undefined> {
    return this.change(id, (prepared) => ({
      ...prepared,
      ...changes,
      name: changes.name === undefined ? prepared.name : cleanName(changes.name),
      updatedAt: this.now().toISOString(),
    }));
  }

  /** Records that the encounter was started, without counting as an edit. */
  markRun(id: string): Promise<PreparedEncounter | undefined> {
    return this.change(id, (prepared) => ({ ...prepared, lastRunAt: this.now().toISOString() }));
  }

  async duplicate(id: string): Promise<PreparedEncounter | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;
    return this.create({
      name: `${original.name} (copy)`.slice(0, PREPARED_NAME_MAX),
      notes: original.notes,
      encounter: { ...original.encounter, id: this.createId() },
      ...(original.placement && { placement: original.placement }),
    });
  }

  /** False if there was nothing to delete. */
  delete(id: string): Promise<boolean> {
    return this.file.update((data) => {
      const encounters = data.encounters.filter((prepared) => prepared.id !== id);
      return { next: { ...data, encounters }, result: encounters.length < data.encounters.length };
    });
  }

  private change(
    id: string,
    apply: (prepared: PreparedEncounter) => PreparedEncounter,
  ): Promise<PreparedEncounter | undefined> {
    return this.file.update((data) => {
      const existing = data.encounters.find((prepared) => prepared.id === id);
      if (!existing) return { next: data, result: undefined };
      const changed = apply(existing);
      return {
        next: { ...data, encounters: data.encounters.map((p) => (p.id === id ? changed : p)) },
        result: changed,
      };
    });
  }
}

function cleanName(name: string | undefined): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ").slice(0, PREPARED_NAME_MAX);
  return trimmed || DEFAULT_PREPARED_NAME;
}
