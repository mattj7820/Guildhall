/**
 * Every change to a character as a small, serialisable action: "set DEX to 14", "take 7 damage",
 * "move the rope". The browser applies them straight away and sends them; the server applies the
 * same actions, with the same function, to whatever is stored now. So two people editing
 * different things never undo each other's work, and relative changes (damage, healing, adding an
 * item) add up rather than overwrite.
 *
 * A set action can carry `from`, the value its sender saw. If the stored value was different,
 * someone else changed it in the meantime: the action still wins (last write wins), and the result
 * says what it replaced, so the editor can tell them.
 */
import { z } from "zod";
import { applyDamage, applyHealing } from "~/combat/hp";
import { parseDice } from "~/dice/parse";
import { SPELL_SHAPES } from "~/maps/grid/shapes";
import {
  ABILITIES,
  PROFICIENCIES,
  SKILLS,
  type Ability,
  type Proficiency,
  type Skill,
} from "./abilities";
import { QUANTITY_MAX } from "./inventory";
import {
  applyInventoryChange,
  DESCRIPTION_MAX,
  NAME_MAX,
  PURSE_MAX,
  SOURCE_MAX,
  type InventoryChange,
} from "./inventory-changes";
import {
  applies,
  applyListChange,
  setFields,
  type ApplyEdits,
  type Edits,
  type ListChange,
  type Listed,
} from "./lists";
import {
  AREA_FEET_MAX,
  ATTACK_BONUS_LIMIT,
  attackSchema,
  DERIVED_KEYS,
  DICE_MAX,
  featureSchema,
  HIT_DICE_MAX,
  HP_MAX,
  inventoryItemSchema,
  LEVEL_MAX,
  LONG_TEXT_MAX,
  NOTES_MAX,
  OVERRIDE_LIMIT,
  SCORE_MAX,
  SCORE_MIN,
  SHORT_TEXT_MAX,
  SLOTS_MAX,
  PREPARE_MAX,
  spellSchema,
  srdSpellRef,
  USES_MAX,
} from "./schema";
import {
  count,
  counterOf,
  limit,
  longRest,
  shortRest,
  withCounter,
  type CounterRef,
  type SpentHitDie,
} from "./tracking";
import {
  ACTIVATIONS,
  COINS,
  FEATURE_SOURCES,
  HIT_DICE,
  RESETS,
  SPELL_LEVELS,
  type Attack,
  type Character,
  type DerivedKey,
  type Feature,
  type FeatureId,
  type HitPoints,
  type Sheet,
  type Spell,
  type Uses,
} from "./types";

export const SHORT_TEXT_FIELDS = [
  "name",
  "species",
  "className",
  "background",
  "speed",
  "concentrating",
] as const;
export const LONG_TEXT_FIELDS = [
  "senses",
  "languages",
  "proficiencies",
  "defences",
  "conditions",
] as const;
export type TextField =
  (typeof SHORT_TEXT_FIELDS)[number] | (typeof LONG_TEXT_FIELDS)[number] | "notes";
export const NUMBER_FIELDS = ["level", "proficiencyBonus", "armourClass"] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];
export type HpField = keyof HitPoints;

export type CharacterAction =
  | { type: "text"; field: TextField; value: string; from?: string }
  | { type: "number"; field: NumberField; value: number; from?: number }
  | { type: "ability"; ability: Ability; value: number; from?: number }
  | { type: "save"; ability: Ability; value: Proficiency; from?: Proficiency }
  | { type: "skill"; skill: Skill; value: Proficiency; from?: Proficiency }
  /** No value clears the override, going back to the computed number. */
  | { type: "override"; key: DerivedKey; value?: number; from?: number }
  | { type: "inspiration"; value: boolean; from?: boolean }
  /** A vault image; none goes back to the note's own image. */
  | { type: "portrait"; value?: string; from?: string }
  | { type: "hp"; field: HpField; value: number; from?: number }
  | { type: "damage"; amount: number }
  | { type: "heal"; amount: number }
  | { type: "inventory"; change: InventoryChange }
  /** None: the character doesn't cast spells. */
  | { type: "spellAbility"; value?: Ability; from?: Ability }
  /** None: the character doesn't prepare spells. */
  | { type: "spellsToPrepare"; value?: number; from?: number }
  /** Uses `by` more of something (a slot cast, a use ticked off), or gives some back if negative. */
  | { type: "count"; counter: CounterRef; by: number }
  /** How many spell slots of a level, or hit dice of a size, there are. */
  | { type: "limit"; counter: LimitRef; value: number; from?: number }
  | { type: "spells"; change: ListChange<Spell> }
  | { type: "attacks"; change: ListChange<Attack> }
  | { type: "features"; change: ListChange<Feature, FeatureEdits> }
  /** Hit dice rolled in the browser (or typed from the table) are carried in the action. */
  | { type: "rest"; rest: "short"; hitDice: SpentHitDie[] }
  | { type: "rest"; rest: "long" };

/** The counters whose maximum is set on its own; a feature's uses are set by editing it. */
export type LimitRef = Exclude<CounterRef, { feature: FeatureId }>;

/**
 * A feature's uses are edited by their maximum and reset only: how many are used is ticked off
 * with `count`, so an edit never undoes someone's tick.
 */
export type FeatureEdits = Omit<Edits<Feature>, "uses"> & {
  uses?: Pick<Uses, "max" | "reset"> | null;
};

export function applyFeatureEdits(feature: Feature, changes: FeatureEdits): Feature {
  const { uses, ...rest } = changes;
  const next = setFields(feature, rest as Edits<Feature>);
  if (uses === undefined) return next;
  if (uses === null) {
    const without = { ...next };
    delete without.uses;
    return without;
  }
  return { ...next, uses: { ...uses, used: Math.min(feature.uses?.used ?? 0, uses.max) } };
}

/**
 * - `changed`: it made a difference.
 * - `unchanged`: it was already so.
 * - `dropped`: it no longer applies (an item that's gone, a sheet field on a companion).
 */
export type Outcome = "changed" | "unchanged" | "dropped";

export interface ActionResult {
  character: Character;
  outcome: Outcome;
  /** A set action replaced someone else's newer value: this one. */
  replaced?: unknown;
}

export function applyAction(character: Character, action: CharacterAction): ActionResult {
  if (action.type === "inventory") return applyToInventory(character, action.change);
  if (action.type === "damage" || action.type === "heal") {
    const hp = currentHp(character);
    const next =
      action.type === "damage" ? applyDamage(hp, action.amount) : applyHealing(hp, action.amount);
    return withHp(character, hp, next);
  }
  if (action.type === "hp") {
    const hp = currentHp(character);
    const result = set(hp[action.field], action.value, action.from);
    if (result.outcome === "unchanged") return { character, outcome: "unchanged" };
    return {
      ...withHp(character, hp, setHp(hp, action.field, action.value)),
      replaced: result.replaced,
    };
  }
  if (character.kind !== "pc") return { character, outcome: "dropped" };
  return applyToSheet(character, action);
}

/** Applies actions in order, as one batch. */
export function applyActions(
  character: Character,
  actions: readonly CharacterAction[],
): { character: Character; results: Omit<ActionResult, "character">[] } {
  const results: Omit<ActionResult, "character">[] = [];
  let current = character;
  for (const action of actions) {
    const { character: next, ...result } = applyAction(current, action);
    current = next;
    results.push(result);
  }
  return { character: current, results };
}

type SheetAction = Exclude<CharacterAction, { type: "inventory" | "damage" | "heal" | "hp" }>;

/** A changed sheet, or the same character if it changed nothing. */
function sheetResult(
  character: Extract<Character, { kind: "pc" }>,
  sheet: Sheet,
  dropped = false,
): ActionResult {
  if (dropped) return { character, outcome: "dropped" };
  return sheet === character.sheet || JSON.stringify(sheet) === JSON.stringify(character.sheet)
    ? { character, outcome: "unchanged" }
    : { character: { ...character, sheet }, outcome: "changed" };
}

function listResult<T extends Listed, E>(
  character: Extract<Character, { kind: "pc" }>,
  key: "spells" | "attacks" | "features",
  change: ListChange<T, E>,
  applyEdits: ApplyEdits<T, E>,
): ActionResult {
  const list = character.sheet[key] as unknown as T[];
  if (!applies(list, change)) return { character, outcome: "dropped" };
  const next = applyListChange(list, change, applyEdits);
  return sheetResult(character, { ...character.sheet, [key]: next });
}

function applyToSheet(
  character: Extract<Character, { kind: "pc" }>,
  action: SheetAction,
): ActionResult {
  const sheet = character.sheet;
  const change = (current: unknown, value: unknown, from: unknown, next: () => Sheet) => {
    const result = set(current, value, from);
    if (result.outcome === "unchanged") return { character, outcome: result.outcome };
    return { character: { ...character, sheet: next() }, ...result };
  };
  switch (action.type) {
    case "text":
      return change(sheet[action.field], action.value, action.from, () => ({
        ...sheet,
        [action.field]: action.value,
      }));
    case "number":
      return change(sheet[action.field], action.value, action.from, () => ({
        ...sheet,
        [action.field]: action.value,
      }));
    case "ability":
      return change(sheet.abilities[action.ability], action.value, action.from, () => ({
        ...sheet,
        abilities: { ...sheet.abilities, [action.ability]: action.value },
      }));
    case "save":
      return change(sheet.saves[action.ability], action.value, action.from, () => ({
        ...sheet,
        saves: { ...sheet.saves, [action.ability]: action.value },
      }));
    case "skill":
      return change(sheet.skills[action.skill], action.value, action.from, () => ({
        ...sheet,
        skills: { ...sheet.skills, [action.skill]: action.value },
      }));
    case "override":
      return change(sheet.overrides[action.key], action.value, action.from, () => {
        const overrides = { ...sheet.overrides };
        if (action.value === undefined) delete overrides[action.key];
        else overrides[action.key] = action.value;
        return { ...sheet, overrides };
      });
    case "inspiration":
      return change(sheet.heroicInspiration, action.value, action.from, () => ({
        ...sheet,
        heroicInspiration: action.value,
      }));
    case "portrait":
      return change(sheet.portrait, action.value, action.from, () => {
        const next = { ...sheet };
        if (action.value === undefined) delete next.portrait;
        else next.portrait = action.value;
        return next;
      });
    case "spellAbility":
      return change(sheet.spellAbility, action.value, action.from, () => {
        const next = { ...sheet };
        if (action.value === undefined) delete next.spellAbility;
        else next.spellAbility = action.value;
        return next;
      });
    case "spellsToPrepare":
      return change(sheet.spellsToPrepare, action.value, action.from, () => {
        const next = { ...sheet };
        if (action.value === undefined) delete next.spellsToPrepare;
        else next.spellsToPrepare = action.value;
        return next;
      });
    case "count": {
      const counter = counterOf(sheet, action.counter);
      if (!counter) return { character, outcome: "dropped" };
      return sheetResult(
        character,
        withCounter(sheet, action.counter, (each) => count(each, action.by)),
      );
    }
    case "limit": {
      const counter = counterOf(sheet, action.counter);
      if (!counter) return { character, outcome: "dropped" };
      return change(counter.max, action.value, action.from, () =>
        withCounter(sheet, action.counter, (each) => limit(each, action.value)),
      );
    }
    case "spells":
      return listResult(character, "spells", action.change, setFields);
    case "attacks":
      return listResult(character, "attacks", action.change, setFields);
    case "features":
      return listResult(character, "features", action.change, applyFeatureEdits);
    case "rest": {
      const rested = action.rest === "short" ? shortRest(sheet, action.hitDice) : longRest(sheet);
      return sheetResult(character, rested.sheet);
    }
  }
}

/**
 * Whether setting `current` to `value` changes anything, and whether it replaces a value someone
 * else set after the sender last saw it (`from`).
 */
function set(
  current: unknown,
  value: unknown,
  from: unknown,
): { outcome: "changed" | "unchanged"; replaced?: unknown } {
  if (current === value) return { outcome: "unchanged" };
  // `from` is only checked when it was sent: a missing key means "no expectation".
  return from !== undefined && current !== from
    ? { outcome: "changed", replaced: current }
    : { outcome: "changed" };
}

/** Current HP stays within the maximum (when there is one). */
function setHp(hp: HitPoints, field: HpField, value: number): HitPoints {
  const next = { ...hp, [field]: value };
  return next.max > 0 && next.current > next.max ? { ...next, current: next.max } : next;
}

function currentHp(character: Character): HitPoints {
  return character.kind === "pc" ? character.sheet.hp : character.hp;
}

function withHp(character: Character, before: HitPoints, hp: HitPoints): ActionResult {
  if (hp.current === before.current && hp.max === before.max && hp.temp === before.temp) {
    return { character, outcome: "unchanged" };
  }
  return {
    character:
      character.kind === "pc"
        ? { ...character, sheet: { ...character.sheet, hp } }
        : { ...character, hp },
    outcome: "changed",
  };
}

function applyToInventory(character: Character, change: InventoryChange): ActionResult {
  if ("id" in change && !character.inventory.items.some((item) => item.id === change.id)) {
    return { character, outcome: "dropped" };
  }
  const inventory = applyInventoryChange(character.inventory, change);
  return inventory === character.inventory
    ? { character, outcome: "unchanged" }
    : { character: { ...character, inventory }, outcome: "changed" };
}

/* Validation of actions arriving from the browser. */

const whole = (min: number, max: number) => z.number().int().min(min).max(max);
const itemId = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const optionalProficiency = z.enum(PROFICIENCIES).optional();

const inventoryChangeSchema: z.ZodType<InventoryChange> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    item: inventoryItemSchema,
    index: z.number().int().optional(),
  }),
  z.object({ type: z.literal("move"), id: itemId, index: z.number().int() }),
  z.object({ type: z.literal("stack"), id: itemId, onto: itemId }),
  z.object({
    type: z.literal("split"),
    id: itemId,
    amount: whole(1, QUANTITY_MAX),
    newId: itemId,
    index: z.number().int().optional(),
    onto: itemId.optional(),
  }),
  z.object({ type: z.literal("remove"), id: itemId }),
  z.object({ type: z.literal("quantity"), id: itemId, quantity: whole(1, QUANTITY_MAX) }),
  z.object({ type: z.literal("equip"), id: itemId, equipped: z.boolean() }),
  z.object({ type: z.literal("attune"), id: itemId, attuned: z.boolean() }),
  z.object({
    type: z.literal("edit"),
    id: itemId,
    changes: z.object({
      name: text(NAME_MAX).optional(),
      icon: z.object({ builtin: z.string().min(1).max(64) }).optional(),
      description: text(DESCRIPTION_MAX).optional(),
      source: z
        .object({
          text: text(SOURCE_MAX).optional(),
          note: z.string().min(1).max(1024).optional(),
        })
        .optional(),
    }),
  }),
  z.object({ type: z.literal("seen"), id: itemId }),
  z.object({ type: z.literal("sort"), order: z.enum(["name", "equipped"]) }),
  z.object({ type: z.literal("purse"), coin: z.enum(COINS), amount: whole(0, PURSE_MAX) }),
  z.object({ type: z.literal("restore"), item: inventoryItemSchema, index: z.number().int() }),
]);

/* What gets used up. */

/** Dice that the roll log can read ("1d8+3"); empty means none. */
const dice = z
  .string()
  .max(DICE_MAX)
  .refine((value) => value === "" || parseDice(value).ok, { message: "Dice like 1d8+3" });
const listName = z.string().trim().min(1).max(SHORT_TEXT_MAX);
const short = text(SHORT_TEXT_MAX);
const long = text(LONG_TEXT_MAX);
const slotLevel = z.union(
  SPELL_LEVELS.filter((level) => level > 0).map((level) => z.literal(level)),
) as z.ZodType<Exclude<Spell["level"], 0>>;
const limitRef: z.ZodType<LimitRef> = z.union([
  z.object({ slot: slotLevel }),
  z.object({ hitDie: z.enum(HIT_DICE) }),
]);
const counterRef: z.ZodType<CounterRef> = z.union([
  z.object({ slot: slotLevel }),
  z.object({ hitDie: z.enum(HIT_DICE) }),
  z.object({ feature: itemId }),
]);
const area = z.object({ shape: z.enum(SPELL_SHAPES), feet: whole(1, AREA_FEET_MAX) });

const spellEdits = z.object({
  name: listName.optional(),
  level: z.union(SPELL_LEVELS.map((level) => z.literal(level))).optional(),
  castingTime: short.optional(),
  range: short.optional(),
  components: short.optional(),
  duration: short.optional(),
  concentration: z.boolean().optional(),
  ritual: z.boolean().optional(),
  attack: z.boolean().optional(),
  save: z.enum(ABILITIES).nullable().optional(),
  roll: dice.nullable().optional(),
  effect: short.nullable().optional(),
  area: area.nullable().optional(),
  ability: z.enum(ABILITIES).nullable().optional(),
  freeUse: itemId.nullable().optional(),
  description: long.nullable().optional(),
  note: z.string().min(1).max(1024).nullable().optional(),
  srd: srdSpellRef.nullable().optional(),
  prepared: z.boolean().optional(),
}) satisfies z.ZodType<Edits<Spell>>;

const attackEdits = z.object({
  name: listName.optional(),
  bonus: whole(-ATTACK_BONUS_LIMIT, ATTACK_BONUS_LIMIT).optional(),
  damage: dice.optional(),
  damageType: short.nullable().optional(),
  notes: long.nullable().optional(),
}) satisfies z.ZodType<Edits<Attack>>;

const featureEdits = z.object({
  name: listName.optional(),
  source: z.enum(FEATURE_SOURCES).optional(),
  sourceName: short.nullable().optional(),
  activation: z.enum(ACTIVATIONS).optional(),
  note: long.nullable().optional(),
  roll: dice.nullable().optional(),
  uses: z
    .object({ max: whole(1, USES_MAX), reset: z.enum(RESETS) })
    .nullable()
    .optional(),
}) satisfies z.ZodType<FeatureEdits>;

function listChangeSchema<T extends Listed, E>(
  item: z.ZodType<T>,
  edits: z.ZodType<E>,
): z.ZodType<ListChange<T, E>> {
  return z.discriminatedUnion("type", [
    z.object({ type: z.literal("add"), item, index: z.number().int().optional() }),
    z.object({ type: z.literal("edit"), id: itemId, changes: edits }),
    z.object({ type: z.literal("remove"), id: itemId }),
    z.object({ type: z.literal("move"), id: itemId, index: z.number().int() }),
    z.object({ type: z.literal("restore"), item, index: z.number().int() }),
  ]) as unknown as z.ZodType<ListChange<T, E>>;
}

/** Items arriving whole (added or put back) are checked like stored ones, and their dice read. */
const withDice = <T extends { roll?: string }>(schema: z.ZodType<T>) =>
  schema.refine((item) => !item.roll || parseDice(item.roll).ok, { message: "Dice like 1d8+3" });

const sheetTrackingActions = [
  z.object({
    type: z.literal("spellAbility"),
    value: z.enum(ABILITIES).optional(),
    from: z.enum(ABILITIES).optional(),
  }),
  z.object({
    type: z.literal("spellsToPrepare"),
    value: whole(0, PREPARE_MAX).optional(),
    from: z.number().optional(),
  }),
  z.object({
    type: z.literal("count"),
    counter: counterRef,
    by: z.number().int().min(-USES_MAX).max(USES_MAX),
  }),
  z.object({
    type: z.literal("limit"),
    counter: limitRef,
    value: whole(0, SLOTS_MAX),
    from: z.number().optional(),
  }),
  z.object({
    type: z.literal("spells"),
    change: listChangeSchema(withDice(spellSchema), spellEdits),
  }),
  z.object({
    type: z.literal("attacks"),
    change: listChangeSchema(
      attackSchema.refine((item) => !item.damage || parseDice(item.damage).ok),
      attackEdits,
    ),
  }),
  z.object({
    type: z.literal("features"),
    change: listChangeSchema(withDice(featureSchema), featureEdits),
  }),
  z.object({
    type: z.literal("rest"),
    rest: z.literal("short"),
    hitDice: z
      .array(
        z
          .object({ die: z.enum(HIT_DICE), face: whole(1, 12) })
          .refine(({ die, face }) => face <= Number(die.slice(1)), { message: "Not on that die" }),
      )
      .max(HIT_DICE_MAX * HIT_DICE.length),
  }),
  z.object({ type: z.literal("rest"), rest: z.literal("long") }),
];

export const MAX_ACTIONS_PER_REQUEST = 200;

export const characterActionSchema: z.ZodType<CharacterAction> = z.union([
  z.object({
    type: z.literal("text"),
    field: z.enum(SHORT_TEXT_FIELDS),
    value: text(SHORT_TEXT_MAX),
    from: text(SHORT_TEXT_MAX).optional(),
  }),
  z.object({
    type: z.literal("text"),
    field: z.enum(LONG_TEXT_FIELDS),
    value: text(LONG_TEXT_MAX),
    from: text(LONG_TEXT_MAX).optional(),
  }),
  z.object({
    type: z.literal("text"),
    field: z.literal("notes"),
    value: text(NOTES_MAX),
    from: text(NOTES_MAX).optional(),
  }),
  z.discriminatedUnion("field", [
    z.object({
      type: z.literal("number"),
      field: z.literal("level"),
      value: whole(1, LEVEL_MAX),
      from: z.number().optional(),
    }),
    z.object({
      type: z.literal("number"),
      field: z.literal("proficiencyBonus"),
      value: whole(0, 10),
      from: z.number().optional(),
    }),
    z.object({
      type: z.literal("number"),
      field: z.literal("armourClass"),
      value: whole(0, 50),
      from: z.number().optional(),
    }),
  ]),
  z.object({
    type: z.literal("ability"),
    ability: z.enum(ABILITIES),
    value: whole(SCORE_MIN, SCORE_MAX),
    from: z.number().optional(),
  }),
  z.object({
    type: z.literal("save"),
    ability: z.enum(ABILITIES),
    value: z.enum(PROFICIENCIES),
    from: optionalProficiency,
  }),
  z.object({
    type: z.literal("skill"),
    skill: z.enum(SKILLS),
    value: z.enum(PROFICIENCIES),
    from: optionalProficiency,
  }),
  z.object({
    type: z.literal("override"),
    key: z.enum(DERIVED_KEYS),
    value: whole(-OVERRIDE_LIMIT, OVERRIDE_LIMIT).optional(),
    from: z.number().optional(),
  }),
  z.object({ type: z.literal("inspiration"), value: z.boolean(), from: z.boolean().optional() }),
  z.object({
    type: z.literal("portrait"),
    value: z.string().trim().min(1).max(1024).optional(),
    from: z.string().optional(),
  }),
  z.object({
    type: z.literal("hp"),
    field: z.enum(["current", "max", "temp"]),
    value: whole(0, HP_MAX),
    from: z.number().optional(),
  }),
  z.object({ type: z.literal("damage"), amount: whole(0, HP_MAX) }),
  z.object({ type: z.literal("heal"), amount: whole(0, HP_MAX) }),
  z.object({ type: z.literal("inventory"), change: inventoryChangeSchema }),
  ...sheetTrackingActions,
]) as z.ZodType<CharacterAction>;

export const actionBatchSchema = z.array(characterActionSchema).min(1).max(MAX_ACTIONS_PER_REQUEST);
