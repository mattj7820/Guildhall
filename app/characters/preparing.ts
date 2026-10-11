/**
 * Preparing spells: which of a character's spells are ready today. Preparing is the player's
 * click, checked against nothing (decision 55); the typed "Spells to prepare" only gives the count
 * something to compare with.
 */
import type { CharacterAction } from "./actions";
import type { Sheet, Spell } from "./types";

/**
 * Ready whatever's prepared, and never counted: cantrips (known, not prepared) and spells cast
 * through a feature's free use (a feat's spell is always prepared).
 */
export function alwaysReady(spell: Spell): boolean {
  return spell.level === 0 || spell.freeUse !== undefined;
}

/** Ready to cast today: always ready, or prepared. */
export function isReady(spell: Spell): boolean {
  return alwaysReady(spell) || spell.prepared;
}

/** Counts towards "Spells to prepare". */
export function countsTowardsPrepared(spell: Spell): boolean {
  return !alwaysReady(spell) && spell.prepared;
}

/** How many of the spells to prepare are prepared. */
export function preparedCount(sheet: Sheet): number {
  return sheet.spells.filter(countsTowardsPrepared).length;
}

/** How many more are prepared than the character prepares; 0 without a number. */
export function overPrepared(sheet: Sheet): number {
  if (sheet.spellsToPrepare === undefined) return 0;
  return Math.max(0, preparedCount(sheet) - sheet.spellsToPrepare);
}

/** Whether any spell can be prepared or unprepared at all. */
export function canPrepare(sheet: Sheet): boolean {
  return sheet.spells.some((spell) => !alwaysReady(spell));
}

/**
 * Whether a newly added spell starts prepared: always for a character who doesn't prepare (so
 * nothing changes for them), otherwise while there's room under the number, so typing in a whole
 * class list doesn't leave every spell prepared.
 */
export function startsPrepared(sheet: Sheet): boolean {
  return sheet.spellsToPrepare === undefined || preparedCount(sheet) < sheet.spellsToPrepare;
}

/** Preparing or unpreparing one spell: an edit of that field only, so two tabs' choices merge. */
export function prepareAction(spell: Spell, prepared: boolean): CharacterAction {
  return { type: "spells", change: { type: "edit", id: spell.id, changes: { prepared } } };
}
