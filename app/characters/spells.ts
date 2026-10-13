/**
 * Casting a spell from the sheet: the ways it can be cast just now, and the actions each one
 * sends. Casting only ticks off what the player spends and notes concentration; rolling is a
 * separate click, and nothing decides what the spell does (decision 55).
 */
import type { CharacterAction } from "./actions";
import { ORDINALS } from "./describe";
import { spellNumbers, type DerivedSheet, type SpellNumbers } from "./derive";
import type { Feature, FeatureId, Sheet, Spell, SpellId, SpellLevel } from "./types";

export type CastOption =
  /** With a slot of this level, which may be higher than the spell's own. */
  | { kind: "slot"; level: Exclude<SpellLevel, 0>; left: number }
  /** Through a feature's uses, without a slot (a feat's once a day). */
  | { kind: "free"; feature: string; name: string; left: number }
  /** As a ritual: no slot, taking longer. */
  | { kind: "ritual" };

/**
 * Every way a levelled spell can be cast now, most usual first: for free while a use is left (it
 * saves a slot), then the lowest slot that's left at its level or above, then higher slots, then
 * as a ritual. Cantrips aren't cast with anything, so they have none.
 */
export function castOptions(sheet: Sheet, spell: Spell): CastOption[] {
  if (spell.level === 0) return [];
  const slots: CastOption[] = sheet.spellSlots.flatMap((slot, index) => {
    const level = (index + 1) as Exclude<SpellLevel, 0>;
    const left = slot.max - slot.used;
    return level >= spell.level && left > 0 ? [{ kind: "slot", level, left }] : [];
  });
  const feature = freeUseOf(sheet, spell);
  const freeLeft = feature?.uses ? feature.uses.max - feature.uses.used : 0;
  return [
    ...(feature && freeLeft > 0
      ? [{ kind: "free", feature: feature.id, name: feature.name, left: freeLeft } as const]
      : []),
    ...slots,
    ...(spell.ritual ? [{ kind: "ritual" } as const] : []),
  ];
}

/** The feature whose uses cast a spell for free, if it's still there and has uses. */
export function freeUseOf(sheet: Sheet, spell: Spell): Feature | undefined {
  if (!spell.freeUse || spell.level === 0) return undefined;
  return sheet.features.find((feature) => feature.id === spell.freeUse && feature.uses);
}

/** The spells a feature's uses cast for free (Magic Initiate's one spell). */
export function freeSpellsOf(sheet: Sheet, feature: FeatureId): Spell[] {
  return sheet.spells.filter((spell) => spell.level > 0 && spell.freeUse === feature);
}

/**
 * Choosing, from the feature, the spell its uses cast: that spell's link set, and any other
 * spell's link to the feature cleared, as one step. Each is an edit of one field, so it merges.
 */
export function chooseFreeSpell(
  sheet: Sheet,
  feature: FeatureId,
  spell: SpellId | null,
): CharacterAction[] {
  const edit = (id: SpellId, freeUse: FeatureId | null): CharacterAction => ({
    type: "spells",
    change: { type: "edit", id, changes: { freeUse } },
  });
  return [
    ...freeSpellsOf(sheet, feature)
      .filter((each) => each.id !== spell)
      .map((each) => edit(each.id, null)),
    ...(spell && sheet.spells.find((each) => each.id === spell)?.freeUse !== feature
      ? [edit(spell, feature)]
      : []),
  ];
}

/** "With a 2nd-level slot (1 left)", "Free (Magic Initiate, 1 left)", "As a ritual". */
export function castOptionLabel(option: CastOption): string {
  switch (option.kind) {
    case "slot":
      return `With a ${ORDINALS[option.level]}-level slot (${option.left} left)`;
    case "free":
      return `Free (${option.name}, ${option.left} left)`;
    case "ritual":
      return "As a ritual";
  }
}

/**
 * What casting sends, as one undoable step: the slot or use spent, and concentration on the spell
 * if it needs it (which ends any other).
 */
export function castActions(sheet: Sheet, spell: Spell, option: CastOption): CharacterAction[] {
  const actions: CharacterAction[] = [];
  if (option.kind === "slot") {
    actions.push({ type: "count", counter: { slot: option.level }, by: 1 });
  } else if (option.kind === "free") {
    actions.push({ type: "count", counter: { feature: option.feature }, by: 1 });
  }
  if (spell.concentration && sheet.concentrating !== spell.name) {
    actions.push({
      type: "text",
      field: "concentrating",
      value: spell.name,
      from: sheet.concentrating,
    });
  }
  return actions;
}

/** What to tell the player: "Cast Fixture Ward with a 1st-level slot; stopped concentrating on…". */
export function castNotice(sheet: Sheet, spell: Spell, option: CastOption): string {
  const how =
    option.kind === "slot"
      ? `with a ${ORDINALS[option.level]}-level slot`
      : option.kind === "free"
        ? `for free (${option.name})`
        : "as a ritual";
  const stopped =
    spell.concentration && sheet.concentrating && sheet.concentrating !== spell.name
      ? `; stopped concentrating on ${sheet.concentrating}`
      : "";
  return `Cast ${spell.name} ${how}${stopped}.`;
}

/**
 * The save DC and attack bonus a spell uses: its own ability's, if it has one (a feat's spell),
 * or the sheet's. None when there's no spellcasting ability to go on.
 */
export function numbersFor(
  sheet: Sheet,
  derived: DerivedSheet,
  spell: Spell,
): SpellNumbers | undefined {
  const own = !spell.ability || spell.ability === sheet.spellAbility;
  return own ? derived.spellcasting : spellNumbers(sheet, spell.ability!);
}
