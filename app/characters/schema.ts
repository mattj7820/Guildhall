/**
 * zod schemas for character data that crosses a trust boundary: the data file and requests.
 * Sheet fields have defaults, so a sheet saved before a field existed still reads, and a blank
 * sheet is simply `blankSheet()`. Objects use `prefault`, which (unlike zod 4's `default`) runs the
 * missing value through the schema, so the fields inside get their defaults too.
 */
import { z } from "zod";
import {
  ABILITIES,
  PASSIVE_SKILLS,
  PROFICIENCIES,
  SKILLS,
  type Ability,
  type Proficiency,
  type Skill,
} from "./abilities";
import { QUANTITY_MAX } from "./inventory";
import { DESCRIPTION_MAX, NAME_MAX, PURSE_MAX, SOURCE_MAX } from "./inventory-changes";
import { SRD_SOURCES } from "~/campaign/srd";
import { SPELL_SHAPES } from "~/maps/grid/shapes";
import {
  ACTIVATIONS,
  FEATURE_SOURCES,
  HIT_DICE,
  RESETS,
  SPELL_LEVELS,
  type Attack,
  type Character,
  type Counter,
  type DerivedKey,
  type Feature,
  type HitDie,
  type Inventory,
  type InventoryItem,
  type Purse,
  type Sheet,
  type Spell,
  type Uses,
} from "./types";

export const SHORT_TEXT_MAX = 80;
export const LONG_TEXT_MAX = 2000;
export const NOTES_MAX = 20_000;
export const ITEMS_MAX = 500;
export const SCORE_MIN = 1;
export const SCORE_MAX = 30;
export const LEVEL_MAX = 20;
export const HP_MAX = 9999;
/** Typed-over bonuses and passive scores. */
export const OVERRIDE_LIMIT = 99;

const entityId = z.string().trim().min(1).max(1024);
const shortText = z.string().max(SHORT_TEXT_MAX).default("");
const longText = z.string().max(LONG_TEXT_MAX).default("");
const whole = (min: number, max: number) => z.number().int().min(min).max(max);

/** Every derived number that can be typed over. */
export const DERIVED_KEYS: DerivedKey[] = [
  ...ABILITIES.map((ability): DerivedKey => `save.${ability}`),
  ...SKILLS.map((skill): DerivedKey => `skill.${skill}`),
  "initiative",
  ...PASSIVE_SKILLS.map((skill): DerivedKey => `passive.${skill}`),
  "spell.dc",
  "spell.attack",
];

/* What gets used up: spells, slots, features' uses, hit dice and attacks. */

export const SPELLS_MAX = 300;
export const FEATURES_MAX = 200;
export const ATTACKS_MAX = 50;
/** A feature's uses: a pool can be large (healing points), a count small. */
export const USES_MAX = 999;
export const SLOTS_MAX = 20;
/** A typed "Spells to prepare". */
export const PREPARE_MAX = 99;
export const HIT_DICE_MAX = LEVEL_MAX;
export const DICE_MAX = 40;
export const AREA_FEET_MAX = 1000;
/** A typed attack bonus. */
export const ATTACK_BONUS_LIMIT = OVERRIDE_LIMIT;

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1).max(SHORT_TEXT_MAX);
const optionalText = (max: number) => z.string().max(max).optional();

/**
 * Used is kept within the maximum by clamping, never by refusing: a stored sheet must always
 * load, whatever an older build wrote.
 */
function counterOf(max: number) {
  return z
    .object({ max: whole(0, max).default(0), used: whole(0, max).default(0) })
    .transform((counter) => ({ ...counter, used: Math.min(counter.used, counter.max) }));
}

export const usesSchema: z.ZodType<Uses> = z
  .object({ max: whole(1, USES_MAX), used: whole(0, USES_MAX).default(0), reset: z.enum(RESETS) })
  .transform((uses) => ({ ...uses, used: Math.min(uses.used, uses.max) }));

export const featureSchema: z.ZodType<Feature> = z.object({
  id,
  name,
  source: z.enum(FEATURE_SOURCES).catch("other"),
  sourceName: optionalText(SHORT_TEXT_MAX),
  activation: z.enum(ACTIVATIONS).catch("other"),
  note: optionalText(LONG_TEXT_MAX),
  roll: optionalText(DICE_MAX),
  uses: usesSchema.optional(),
});

export const attackSchema: z.ZodType<Attack> = z.object({
  id,
  name,
  bonus: whole(-ATTACK_BONUS_LIMIT, ATTACK_BONUS_LIMIT),
  damage: z.string().max(DICE_MAX).default(""),
  damageType: optionalText(SHORT_TEXT_MAX),
  notes: optionalText(LONG_TEXT_MAX),
});

/** A link a newer build made, or to an SRD this one doesn't know, is dropped, never refused. */
export const srdSpellRef = z.object({
  source: z.enum(SRD_SOURCES),
  id: z.string().min(1).max(64),
});

export const spellSchema: z.ZodType<Spell> = z.object({
  id,
  name,
  level: z.union(SPELL_LEVELS.map((level) => z.literal(level))),
  castingTime: shortText,
  range: shortText,
  components: shortText,
  duration: shortText,
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  attack: z.boolean().default(false),
  save: z.enum(ABILITIES).optional(),
  roll: optionalText(DICE_MAX),
  effect: optionalText(SHORT_TEXT_MAX),
  area: z.object({ shape: z.enum(SPELL_SHAPES), feet: whole(1, AREA_FEET_MAX) }).optional(),
  ability: z.enum(ABILITIES).optional(),
  freeUse: id.optional(),
  description: optionalText(LONG_TEXT_MAX),
  note: entityId.optional(),
  srd: srdSpellRef.optional().catch(undefined),
  // Spells stored before preparing existed were all ready, so they stay so.
  prepared: z.boolean().catch(true),
});

const SLOT_LEVELS = SPELL_LEVELS.length - 1;

/** Always nine levels, so a sheet from before slots existed gets empty ones. */
const spellSlots = z
  .array(counterOf(SLOTS_MAX))
  .max(SLOT_LEVELS)
  .default([])
  .transform((slots) =>
    Array.from({ length: SLOT_LEVELS }, (_, index) => slots[index] ?? { max: 0, used: 0 }),
  );

const proficiency = z.enum(PROFICIENCIES).catch("none");

const hitPoints = z
  .object({
    current: whole(0, HP_MAX).default(0),
    max: whole(0, HP_MAX).default(0),
    temp: whole(0, HP_MAX).default(0),
  })
  .prefault({});

/** An object with every key, each defaulting to `fallback`. */
function record<K extends string, V extends NonNullable<unknown>>(
  keys: readonly K[],
  value: z.ZodType<V>,
  fallback: V,
): z.ZodType<Record<K, V>> {
  // zod can't tell that a generic V is never undefined, which `default` requires.
  const shape = Object.fromEntries(keys.map((key) => [key, value.default(fallback as never)]));
  return z.object(shape).prefault({}) as unknown as z.ZodType<Record<K, V>>;
}

export const sheetSchema: z.ZodType<Sheet> = z.object({
  name: shortText,
  species: shortText,
  className: shortText,
  level: whole(1, LEVEL_MAX).default(1),
  background: shortText,
  portrait: z.string().trim().min(1).max(1024).optional(),
  abilities: record<Ability, number>(ABILITIES, whole(SCORE_MIN, SCORE_MAX), 10),
  proficiencyBonus: whole(0, 10).default(2),
  saves: record<Ability, Proficiency>(ABILITIES, proficiency, "none"),
  skills: record<Skill, Proficiency>(SKILLS, proficiency, "none"),
  overrides: z
    .partialRecord(z.enum(DERIVED_KEYS), whole(-OVERRIDE_LIMIT, OVERRIDE_LIMIT))
    .default({}),
  armourClass: whole(0, 50).default(10),
  speed: shortText.default("30 ft."),
  hp: hitPoints,
  heroicInspiration: z.boolean().default(false),
  senses: longText,
  languages: longText,
  proficiencies: longText,
  defences: longText,
  conditions: longText,
  notes: z.string().max(NOTES_MAX).default(""),
  spellAbility: z.enum(ABILITIES).optional(),
  // Clamped rather than refused; anything that isn't a number reads as blank.
  spellsToPrepare: z
    .number()
    .int()
    .min(0)
    .transform((value) => Math.min(value, PREPARE_MAX))
    .optional()
    .catch(undefined),
  spells: z.array(spellSchema).max(SPELLS_MAX).default([]),
  spellSlots,
  hitDice: record<HitDie, Counter>(HIT_DICE, counterOf(HIT_DICE_MAX), { max: 0, used: 0 }),
  features: z.array(featureSchema).max(FEATURES_MAX).default([]),
  attacks: z.array(attackSchema).max(ATTACKS_MAX).default([]),
  concentrating: shortText,
});

/** A new, empty sheet: every default. */
export function blankSheet(): Sheet {
  return sheetSchema.parse({});
}

export const inventoryItemSchema: z.ZodType<InventoryItem> = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(NAME_MAX),
  icon: z.object({ builtin: z.string().min(1).max(64) }),
  quantity: whole(1, QUANTITY_MAX),
  equipped: z.boolean(),
  attuned: z.boolean(),
  note: entityId.optional(),
  description: z.string().max(DESCRIPTION_MAX).optional(),
  source: z
    .object({ text: z.string().max(SOURCE_MAX).optional(), note: entityId.optional() })
    .optional(),
  givenBy: z.string().max(SHORT_TEXT_MAX).optional(),
  unseen: z.boolean().optional(),
});

const coins = whole(0, PURSE_MAX).default(0);

export const purseSchema: z.ZodType<Purse> = z
  .object({ cp: coins, sp: coins, ep: coins, gp: coins, pp: coins })
  .prefault({});

export const inventorySchema: z.ZodType<Inventory> = z
  .object({
    items: z
      .array(inventoryItemSchema)
      .max(ITEMS_MAX)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: "Two items have the same ID",
      })
      .default([]),
    purse: purseSchema,
  })
  .prefault({ purse: {} });

const characterBase = {
  id: z.string().min(1).max(64),
  note: entityId,
  revision: whole(0, Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  inventory: inventorySchema,
};

export const characterSchema: z.ZodType<Character> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pc"), ...characterBase, sheet: sheetSchema }),
  z.object({
    kind: z.literal("companion"),
    ...characterBase,
    hp: hitPoints,
  }),
]);
