/**
 * Finding a monster among hundreds: the DM's own statblocks and the SRD's, by name, with filters
 * for where it's from, its challenge rating and its type. Pure and isomorphic.
 */
import { SRD_RULES } from "~/campaign/srd";
import { byName, matchRank } from "~/shared/name-search";
import type { CreatureOption } from "./types";

/** Where a statblock is from, as the picker tags it: the DM's vault, or the SRD by its rules. */
export type CreatureTag = "Mine" | "2024" | "2014";
export const CREATURE_TAGS: CreatureTag[] = ["Mine", "2024", "2014"];

export const tagOf = (creature: CreatureOption): CreatureTag =>
  creature.ref.source ? SRD_RULES[creature.ref.source] : "Mine";

/** Every challenge rating, lowest first. */
export const CHALLENGE_RATINGS = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
];

/** "1/4" → 0.25. Undefined if it isn't a challenge rating. */
export function challengeValue(rating: string | undefined): number | undefined {
  const match = /^(\d+)(?:\/(\d+))?$/.exec(rating?.trim() ?? "");
  if (!match) return undefined;
  return match[2] ? Number(match[1]) / Number(match[2]) : Number(match[1]);
}

export interface CreatureFilters {
  query: string;
  /** Which tags to show; all of them when empty. */
  tags: ReadonlySet<CreatureTag>;
  /** Inclusive bounds, as challenge ratings ("1/4"); blank for no bound. */
  lowestChallenge?: string;
  highestChallenge?: string;
  /** A type as `creatureTypes` lists it, e.g. "beast"; blank for any. */
  type?: string;
}

/** The types to filter by, without case (2014's "beast" is 2024's "Beast"), alphabetically. */
export function creatureTypes(creatures: CreatureOption[]): string[] {
  return [...new Set(creatures.flatMap((c) => (c.type ? [c.type.toLowerCase()] : [])))].sort();
}

/** With the same name: the DM's own first, then the 2024 rules, then 2014. */
const TAG_ORDER: Record<CreatureTag, number> = { Mine: 0, "2024": 1, "2014": 2 };

/**
 * The creatures that match. While searching, best first: an exact name, then one starting with
 * the search, then a word in it starting with it, then the search anywhere; within each, the DM's
 * own, then 2024, then 2014, each by name. Otherwise everything by name, tagged (the DM found
 * that easier to browse than their own first).
 */
export function findCreatures(
  creatures: CreatureOption[],
  filters: CreatureFilters,
): CreatureOption[] {
  const query = filters.query.trim().toLowerCase();
  const lowest = challengeValue(filters.lowestChallenge) ?? -Infinity;
  const highest = challengeValue(filters.highestChallenge) ?? Infinity;
  const filtering = filters.lowestChallenge || filters.highestChallenge;
  return creatures
    .flatMap((creature) => {
      if (filters.tags.size && !filters.tags.has(tagOf(creature))) return [];
      if (filters.type && creature.type?.toLowerCase() !== filters.type) return [];
      if (filtering) {
        const challenge = challengeValue(creature.challenge);
        if (challenge === undefined || challenge < lowest || challenge > highest) return [];
      }
      const rank = matchRank([creature.name, creature.noteTitle ?? ""], query);
      return rank === undefined ? [] : [{ creature, rank }];
    })
    .sort((a, b) => {
      const name = byName.compare(a.creature.name, b.creature.name);
      const tag = TAG_ORDER[tagOf(a.creature)] - TAG_ORDER[tagOf(b.creature)];
      const note = byName.compare(a.creature.noteTitle ?? "", b.creature.noteTitle ?? "");
      return query ? a.rank - b.rank || tag || name || note : name || tag || note;
    })
    .map(({ creature }) => creature);
}

/**
 * Each creature as one line in a plain list, keyed by that line: "Wolf (2014, CR 1/4)", the DM's
 * own with their note ("Wolf (Mine: Fixture Pack, CR 1/2)"). Lines that would read the same are
 * numbered, so each still finds one creature.
 */
export function creatureLines(creatures: CreatureOption[]): Map<string, CreatureOption> {
  const lines = new Map<string, CreatureOption>();
  for (const creature of creatures) {
    const tag = tagOf(creature);
    const from =
      tag === "Mine" && creature.noteTitle && creature.noteTitle !== creature.name
        ? `Mine: ${creature.noteTitle}`
        : tag;
    const line = `${creature.name} (${from}${creature.challenge ? `, CR ${creature.challenge}` : ""})`;
    let unique = line;
    for (let count = 2; lines.has(unique); count++) unique = `${line} #${count}`;
    lines.set(unique, creature);
  }
  return lines;
}

/** A note's own statblock (its first), for an NPC token linked to it. */
export function statblockOfNote(
  creatures: CreatureOption[],
  note: string,
): CreatureOption | undefined {
  return creatures.find((creature) => !creature.ref.source && creature.ref.entityId === note);
}
