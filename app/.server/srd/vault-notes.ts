/**
 * Finds a monster or spell in the bundled SRD data and writes it out as a vault note, for the
 * authoring skills (`scripts/srd-lookup.ts`). Every word is the data's own: the statblock's fields
 * are written as they are, and a spell's text is only laid out.
 */
import { stringify } from "yaml";
import { SRD_DOCUMENTS, SRD_RULES, SRD_SOURCES, type SrdSource } from "~/campaign/srd";
import monsters51 from "./monsters-5.1.json";
import monsters52 from "./monsters-5.2.json";
import type { StoredSpell } from "./spells";
import spells51 from "./spells-5.1.json";
import spells52 from "./spells-5.2.json";

export type SrdKind = "monster" | "spell";

export interface StoredMonster {
  id: string;
  statblock: { name: string };
  lore?: string;
}

const MONSTERS: Record<SrdSource, StoredMonster[]> = {
  "srd-5.1": monsters51.monsters,
  "srd-5.2": monsters52.monsters,
};
const SPELLS: Record<SrdSource, StoredSpell[]> = {
  "srd-5.1": spells51.spells,
  "srd-5.2": spells52.spells,
};

export interface Match {
  source: SrdSource;
  name: string;
  /** "2024 (SRD 5.2.1)" */
  edition: string;
}

export type LookUp =
  | { found: Match; note: string }
  /** No single answer: the names that come closest, best first (maybe none). */
  | { choices: Match[] };

/**
 * The note for `query`, by exact name (any case) in the SRDs asked for. A name in both isn't
 * picked between: the 2014 and 2024 versions differ, so the caller asks which.
 */
export function lookUp(
  kind: SrdKind,
  query: string,
  sources: readonly SrdSource[] = SRD_SOURCES,
): LookUp {
  const wanted = query.trim().toLowerCase();
  const candidates = sources.flatMap((source) =>
    kind === "monster"
      ? MONSTERS[source].map((monster) => ({
          match: match(source, monster.statblock.name),
          note: () => monsterNote(monster),
        }))
      : SPELLS[source].map((spell) => ({
          match: match(source, spell.name),
          note: () => spellNote(spell, source),
        })),
  );
  const exact = candidates.filter((each) => each.match.name.toLowerCase() === wanted);
  if (exact.length === 1) return { found: exact[0].match, note: exact[0].note() };

  const rank = ({ name }: Match) => {
    const lower = name.toLowerCase();
    return lower === wanted ? 0 : lower.startsWith(wanted) ? 1 : lower.includes(wanted) ? 2 : 3;
  };
  const choices = candidates
    .map((each) => each.match)
    .filter((each) => rank(each) < 3)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, 15);
  return { choices };
}

const match = (source: SrdSource, name: string): Match => ({
  source,
  name,
  edition: `${SRD_RULES[source]} (${SRD_DOCUMENTS[source]})`,
});

/** The SRD's description (2014 has some), then the statblock in the plugin's YAML. */
export function monsterNote(monster: StoredMonster): string {
  const yaml = stringify(monster.statblock, { lineWidth: 0 }).trimEnd();
  return [monster.lore, "```statblock\n" + yaml + "\n```"].filter(Boolean).join("\n\n") + "\n";
}

/** The frontmatter the spell picker reads (the README's "Spell notes"), then the text. */
export function spellNote(spell: StoredSpell, source: SrdSource): string {
  const fields = {
    type: "spell",
    level: spell.level,
    school: spell.school,
    classes: spell.classes,
    casting_time: spell.castingTime,
    range: spell.range,
    // A few 2024 spells have none in the data (their range swallowed it).
    ...(spell.components && { components: spell.components }),
    duration: spell.duration,
    concentration: spell.concentration,
    ritual: spell.ritual,
    ...(spell.attack && { attack: true }),
    ...(spell.save && { save: spell.save }),
    ...(spell.roll && { roll: spell.roll }),
    ...(spell.effect && { effect: spell.effect }),
    ...(spell.area && { area: `${spell.area.feet} ft ${spell.area.shape}` }),
  };
  // Each edition's book calls it this.
  const higher =
    SRD_RULES[source] === "2014" ? "At Higher Levels." : "Using a Higher-Level Spell Slot.";
  const body = [
    spell.text,
    spell.material && `**Material:** ${spell.material}`,
    spell.higherLevel && `**${higher}** ${spell.higherLevel}`,
  ];
  return `---\n${stringify(fields, { lineWidth: 0 })}---\n\n${body.filter(Boolean).join("\n\n")}\n`;
}
