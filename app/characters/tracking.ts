/**
 * What gets used up on a sheet, and rests that give it back. Pure, and the same in the browser
 * and on the server: a slot ticked off or a rest taken is an action applied to what's stored now
 * (see `actions.ts`), so a tick in one tab and a rest in another both count.
 *
 * Rests follow the 2024 rules, simplified to what the sheet tracks, and only ever happen when the
 * player presses the button (decision 55): nothing here decides that a rest has happened.
 */
import { applyHealing } from "~/combat/hp";
import { abilityModifier } from "./abilities";
import {
  HIT_DICE,
  type Counter,
  type FeatureId,
  type HitDie,
  type Reset,
  type Sheet,
  type SpellLevel,
} from "./types";

/** One thing that's counted: spell slots of a level, hit dice of a size, or a feature's uses. */
export type CounterRef =
  { slot: Exclude<SpellLevel, 0> } | { hitDie: HitDie } | { feature: FeatureId };

/** The counter on the sheet, if there is one (a feature may have gone, or have no uses). */
export function counterOf(sheet: Sheet, ref: CounterRef): Counter | undefined {
  if ("slot" in ref) return sheet.spellSlots[ref.slot - 1];
  if ("hitDie" in ref) return sheet.hitDice[ref.hitDie];
  return sheet.features.find((feature) => feature.id === ref.feature)?.uses;
}

/** The sheet with one counter changed; the sheet itself if there's no such counter. */
export function withCounter(
  sheet: Sheet,
  ref: CounterRef,
  change: (counter: Counter) => Counter,
): Sheet {
  if ("slot" in ref) {
    const index = ref.slot - 1;
    const slots = sheet.spellSlots.map((slot, at) => (at === index ? change(slot) : slot));
    return { ...sheet, spellSlots: slots };
  }
  if ("hitDie" in ref) {
    return {
      ...sheet,
      hitDice: { ...sheet.hitDice, [ref.hitDie]: change(sheet.hitDice[ref.hitDie]) },
    };
  }
  return {
    ...sheet,
    features: sheet.features.map((feature) =>
      feature.id === ref.feature && feature.uses
        ? { ...feature, uses: { ...feature.uses, ...change(feature.uses) } }
        : feature,
    ),
  };
}

/** Uses `by` more (or gives back, when negative), never below none or above the maximum. */
export function count(counter: Counter, by: number): Counter {
  return { ...counter, used: clamp(counter.used + by, 0, counter.max) };
}

/** A new maximum; what's used comes down with it, so it's never more than there is. */
export function limit(counter: Counter, max: number): Counter {
  return { max, used: Math.min(counter.used, max) };
}

/** A spent hit die heals its roll plus the CON modifier, and always at least 1. */
export function hitDieHealing(face: number, conModifier: number): number {
  return Math.max(1, face + conModifier);
}

/** A hit die rolled (or rolled at the table and typed in) during a short rest. */
export interface SpentHitDie {
  die: HitDie;
  face: number;
}

/** What a rest did, for its notice and for telling who's watching. */
export interface RestOutcome {
  sheet: Sheet;
  /** Hit dice spent, in order; any already spent elsewhere aren't. */
  spent: SpentHitDie[];
  healed: number;
}

/**
 * A short rest: each hit die rolled is spent and heals, as long as one of that size is left, and
 * every feature that resets on a short rest gets its uses back.
 */
export function shortRest(sheet: Sheet, dice: readonly SpentHitDie[]): RestOutcome {
  const conModifier = abilityModifier(sheet.abilities.con);
  let hitDice = sheet.hitDice;
  let hp = sheet.hp;
  let healed = 0;
  const spent: SpentHitDie[] = [];
  for (const each of dice) {
    const pool = hitDice[each.die];
    if (pool.used >= pool.max) continue;
    hitDice = { ...hitDice, [each.die]: count(pool, 1) };
    const before = hp.current;
    hp = applyHealing(hp, hitDieHealing(each.face, conModifier));
    healed += hp.current - before;
    spent.push(each);
  }
  return { sheet: resetFeatures({ ...sheet, hitDice, hp }, ["short"]), spent, healed };
}

/**
 * A long rest (2024): all hit points back and temporary ones gone, every hit die and spell slot
 * back, every feature that resets on a short or long rest, and concentration ends. Uses kept by
 * hand stay as they are.
 */
export function longRest(sheet: Sheet): RestOutcome {
  const healed = sheet.hp.max - Math.min(sheet.hp.current, sheet.hp.max);
  const hitDice = Object.fromEntries(
    HIT_DICE.map((die) => [die, { ...sheet.hitDice[die], used: 0 }]),
  ) as Sheet["hitDice"];
  return {
    sheet: resetFeatures(
      {
        ...sheet,
        hp: { ...sheet.hp, current: Math.max(sheet.hp.current, sheet.hp.max), temp: 0 },
        hitDice,
        spellSlots: sheet.spellSlots.map((slot) => ({ ...slot, used: 0 })),
        concentrating: "",
      },
      ["short", "long"],
    ),
    spent: [],
    healed,
  };
}

function resetFeatures(sheet: Sheet, resets: readonly Reset[]): Sheet {
  return {
    ...sheet,
    features: sheet.features.map((feature) =>
      feature.uses && feature.uses.used > 0 && resets.includes(feature.uses.reset)
        ? { ...feature, uses: { ...feature.uses, used: 0 } }
        : feature,
    ),
  };
}

/** Every counter on the sheet, for working out what a rest changed. */
export function allCounters(sheet: Sheet): { ref: CounterRef; counter: Counter }[] {
  return [
    ...sheet.spellSlots.map((counter, index) => ({
      ref: { slot: (index + 1) as Exclude<SpellLevel, 0> },
      counter,
    })),
    ...HIT_DICE.map((die) => ({ ref: { hitDie: die }, counter: sheet.hitDice[die] })),
    ...sheet.features.flatMap((feature) =>
      feature.uses ? [{ ref: { feature: feature.id }, counter: feature.uses }] : [],
    ),
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * What a rest did, in words, from the sheet before and after it: "Long rest: +15 HP, 2 hit dice
 * back, 3 slots back, Focus points back, Fixture Ward ended."
 */
export function restSummary(rest: "short" | "long", before: Sheet, after: Sheet): string {
  const used = (sheet: Sheet, counters: (sheet: Sheet) => Counter[]) =>
    counters(sheet).reduce((sum, counter) => sum + counter.used, 0);
  const hitDice = (sheet: Sheet) => HIT_DICE.map((die) => sheet.hitDice[die]);
  const parts: string[] = [];

  const healed = after.hp.current - before.hp.current;
  if (healed > 0) parts.push(`+${healed} HP`);
  const dice = used(after, hitDice) - used(before, hitDice);
  if (dice > 0) parts.push(`spent ${plural(dice, "hit die", "hit dice")}`);
  if (dice < 0) parts.push(`${plural(-dice, "hit die", "hit dice")} back`);
  const slots =
    used(before, (sheet) => sheet.spellSlots) - used(after, (sheet) => sheet.spellSlots);
  if (slots > 0) parts.push(`${plural(slots, "slot", "slots")} back`);
  for (const feature of before.features) {
    const now = after.features.find((each) => each.id === feature.id)?.uses;
    if (feature.uses && now && now.used < feature.uses.used) parts.push(`${feature.name} back`);
  }
  if (before.concentrating && !after.concentrating) parts.push(`${before.concentrating} ended`);

  const name = rest === "short" ? "Short rest" : "Long rest";
  return parts.length > 0 ? `${name}: ${parts.join(", ")}.` : `${name}: nothing to get back.`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
