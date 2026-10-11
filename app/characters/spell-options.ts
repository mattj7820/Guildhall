/**
 * The spells a sheet can pick from (the SRD's, and vault spell notes the viewer may read) and what
 * picking one fills in: an ordinary spell, the player's to edit, linked to where it came from.
 * Isomorphic.
 */
import { SRD_RULES, type SrdSource } from "~/campaign/srd";
import type { EntityId } from "~/campaign/types";
import type { Ability } from "./abilities";
import { startsPrepared } from "./preparing";
import { DICE_MAX, SHORT_TEXT_MAX } from "./schema";
import type { Sheet, Spell, SpellArea, SpellId, SpellLevel, SrdSpellRef } from "./types";

/** One spell in the picker, without its text (loaded when it's opened). */
export interface SpellOption {
  /** `spellKey`: "srd-5.2/fireball", or "note/<entity ID>". */
  key: string;
  name: string;
  /** Undefined for a vault note that doesn't give one. */
  level?: SpellLevel;
  school?: string;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack: boolean;
  save?: Ability;
  roll?: string;
  effect?: string;
  area?: SpellArea;
  srd?: SrdSpellRef;
  note?: EntityId;
  /** A vault note players can't read, marked for the DM. */
  hiddenFromPlayers?: true;
}

/** Where a spell is from, as the picker tags it: the DM's vault, or the SRD by its rules. */
export type SpellTag = "Mine" | "2024" | "2014";
export const SPELL_TAGS: SpellTag[] = ["Mine", "2024", "2014"];

export const spellTag = (option: Pick<SpellOption, "srd">): SpellTag =>
  option.srd ? SRD_RULES[option.srd.source] : "Mine";

const NOTE_KEY = "note/";

export const srdSpellKey = (ref: SrdSpellRef) => `${ref.source}/${ref.id}`;
export const noteSpellKey = (note: EntityId) => `${NOTE_KEY}${note}`;

/** A key's SRD spell or note; undefined if it's neither. */
export function parseSpellKey(
  key: string,
  sources: readonly SrdSource[],
): { srd: SrdSpellRef } | { note: EntityId } | undefined {
  if (key.startsWith(NOTE_KEY)) {
    const note = key.slice(NOTE_KEY.length);
    return note ? { note } : undefined;
  }
  const slash = key.indexOf("/");
  const source = sources.find((each) => each === key.slice(0, slash));
  const id = key.slice(slash + 1);
  return source && id ? { srd: { source, id } } : undefined;
}

/**
 * The spell picking `option` adds to `sheet`. It starts prepared as a typed spell would (decision
 * 72), and fits the sheet's fields: a reaction's trigger stays in the text ("Reaction, which you
 * take when…" is "Reaction"), and nothing is longer than a sheet holds.
 */
export function pickedSpell(option: SpellOption, id: SpellId, sheet: Sheet): Spell {
  const short = (text: string) => text.trim().slice(0, SHORT_TEXT_MAX);
  return {
    id,
    name: short(option.name),
    level: option.level ?? 0,
    castingTime: short(option.castingTime.split(", which")[0]),
    range: short(option.range),
    components: short(option.components),
    duration: short(option.duration),
    concentration: option.concentration,
    ritual: option.ritual,
    attack: option.attack,
    ...(option.save && { save: option.save }),
    ...(option.roll && option.roll.length <= DICE_MAX && { roll: option.roll }),
    ...(option.effect && { effect: short(option.effect) }),
    ...(option.area && { area: option.area }),
    ...(option.note && { note: option.note }),
    ...(option.srd && { srd: option.srd }),
    prepared: startsPrepared(sheet),
  };
}
