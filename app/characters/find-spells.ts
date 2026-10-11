/**
 * Finding a spell among hundreds: the SRD's and the DM's own spell notes, by name, with filters
 * for where it's from, its level, a class's list, concentration and rituals. Pure and isomorphic.
 */
import { byName, matchRank } from "~/shared/name-search";
import { spellTag, type SpellOption, type SpellTag } from "./spell-options";
import type { SpellLevel } from "./types";

export interface SpellFilters {
  query: string;
  /** Which tags to show; all of them when empty. */
  tags: ReadonlySet<SpellTag>;
  level?: SpellLevel;
  /** A class as `spellClasses` lists it; blank for any. */
  className?: string;
  concentration?: boolean;
  ritual?: boolean;
}

/** The classes to filter by: the SRD's and any a note names, alphabetically. */
export function spellClasses(spells: SpellOption[]): string[] {
  return [...new Set(spells.flatMap((spell) => spell.classes))].sort(byName.compare);
}

/** With the same name: the DM's own first, then the 2024 rules, then 2014. */
const TAG_ORDER: Record<SpellTag, number> = { Mine: 0, "2024": 1, "2014": 2 };

/** Spells without a level (notes that don't say) come last. */
const levelOrder = (spell: SpellOption) => spell.level ?? Infinity;

/**
 * The spells that match. While searching, best first: an exact name, then one starting with the
 * search, then a word in it starting with it, then the search anywhere; within each, the DM's own,
 * then 2024, then 2014, each by name. Otherwise by level (cantrips first), then name, tagged.
 */
export function findSpells(spells: SpellOption[], filters: SpellFilters): SpellOption[] {
  const query = filters.query.trim().toLowerCase();
  const className = filters.className?.toLowerCase();
  return spells
    .flatMap((spell) => {
      if (filters.tags.size && !filters.tags.has(spellTag(spell))) return [];
      if (filters.level !== undefined && spell.level !== filters.level) return [];
      if (className && !spell.classes.some((each) => each.toLowerCase() === className)) return [];
      if (filters.concentration && !spell.concentration) return [];
      if (filters.ritual && !spell.ritual) return [];
      const rank = matchRank([spell.name], query);
      return rank === undefined ? [] : [{ spell, rank }];
    })
    .sort((a, b) => {
      const name = byName.compare(a.spell.name, b.spell.name);
      const tag = TAG_ORDER[spellTag(a.spell)] - TAG_ORDER[spellTag(b.spell)];
      if (query) return a.rank - b.rank || tag || name;
      return levelOrder(a.spell) - levelOrder(b.spell) || name || tag;
    })
    .map(({ spell }) => spell);
}
