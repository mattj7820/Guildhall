/** zod schemas for combat data that crosses a trust boundary: browser storage, requests, files. */
import { z } from "zod";
import { SRD_SOURCES } from "~/campaign/srd";
import { CONDITIONS, type Encounter, type PreparedEncounter } from "./types";

const player = z.object({ id: z.string(), name: z.string() });
export const statblockRef = z.object({
  entityId: z.string(),
  name: z.string(),
  // A source this version doesn't know (stored by a later one) is read as the vault's: the ref
  // then finds nothing, and the combatant keeps its copied numbers. Never refused.
  source: z.enum(SRD_SOURCES).optional().catch(undefined),
});

const base = {
  id: z.string(),
  name: z.string(),
  initiative: z.number().int().nullable(),
  tiebreaks: z.array(z.number().int()),
  conditions: z.array(z.enum(CONDITIONS)),
  note: z.string(),
  joinedRound: z.number().int().optional(),
};

export const encounterSchema: z.ZodType<Encounter> = z.object({
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
        hidden: z.boolean().optional(),
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

export const PREPARED_NAME_MAX = 100;
export const PREPARED_NOTES_MAX = 2000;

/** A prepared encounter's fight is always waiting to start: setup phase, no turn yet. */
export const unstartedEncounterSchema = encounterSchema.refine(
  (encounter) =>
    encounter.phase === "setup" && encounter.round === 0 && encounter.activeId === null,
  { message: "A prepared encounter can't have started." },
);

const fraction = z.number().min(0).max(1);

export const preparedPlacementSchema = z.object({
  map: z.string().min(1),
  at: z.record(z.string().min(1), z.tuple([fraction, fraction])),
});

export const preparedEncounterSchema: z.ZodType<PreparedEncounter> = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(PREPARED_NAME_MAX),
  notes: z.string().max(PREPARED_NOTES_MAX),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastRunAt: z.iso.datetime().optional(),
  encounter: unstartedEncounterSchema,
  placement: preparedPlacementSchema.optional(),
});

/** What the prepared-encounter editor sends when it saves. */
export const preparedChangesSchema = z.object({
  name: z.string().max(PREPARED_NAME_MAX),
  notes: z.string().max(PREPARED_NOTES_MAX),
  encounter: unstartedEncounterSchema,
});
