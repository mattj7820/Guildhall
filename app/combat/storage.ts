import { z } from "zod";
import { CONDITIONS, type Encounter } from "./types";

/**
 * Keeps the in-progress encounter in the browser's localStorage so a reload doesn't lose it.
 * What comes back is validated: storage can hold anything (an old format, a hand edit).
 */
export const ENCOUNTER_STORAGE_KEY = "guildhall:encounter";

const player = z.object({ id: z.string(), name: z.string() });
const statblockRef = z.object({ entityId: z.string(), name: z.string() });

const base = {
  id: z.string(),
  name: z.string(),
  initiative: z.number().int().nullable(),
  tiebreaks: z.array(z.number().int()),
  conditions: z.array(z.enum(CONDITIONS)),
  note: z.string(),
  joinedRound: z.number().int().optional(),
};

const encounterSchema: z.ZodType<Encounter> = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  phase: z.enum(["setup", "active"]),
  round: z.number().int().nonnegative(),
  activeId: z.string().nullable(),
  combatants: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        ...base,
        kind: z.literal("monster"),
        statblock: statblockRef,
        initiativeBonus: z.number().int(),
        armorClass: z.number().int().optional(),
        hp: z.object({
          current: z.number().int().nonnegative(),
          max: z.number().int().positive(),
          temp: z.number().int().nonnegative(),
        }),
      }),
      z.object({
        ...base,
        kind: z.literal("player"),
        controller: player,
        entityId: z.string().optional(),
        statblock: statblockRef.optional(),
      }),
    ]),
  ),
});

export type LoadResult =
  | { status: "empty" }
  | { status: "restored"; encounter: Encounter }
  /** Something was saved but can't be used; the DM is told rather than it being dropped silently. */
  | { status: "unreadable" };

export function loadEncounter(storage: Pick<Storage, "getItem">): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(ENCOUNTER_STORAGE_KEY);
  } catch {
    return { status: "unreadable" };
  }
  if (raw === null) return { status: "empty" };
  try {
    const parsed = encounterSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { status: "restored", encounter: parsed.data }
      : { status: "unreadable" };
  } catch {
    return { status: "unreadable" };
  }
}

/** The browser's localStorage, or undefined where it's unavailable (even reading it can throw). */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Returns false if the browser refused (storage full or disabled), so the page can say so. */
export function saveEncounter(storage: Pick<Storage, "setItem">, encounter: Encounter): boolean {
  try {
    storage.setItem(ENCOUNTER_STORAGE_KEY, JSON.stringify(encounter));
    return true;
  } catch {
    return false;
  }
}
