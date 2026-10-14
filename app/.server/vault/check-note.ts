/**
 * Checks a note before it goes into the vault (the authoring skills run it through
 * `scripts/check-note.ts`): does Guildhall read it the way it was meant? Problems are things
 * Guildhall would quietly drop or refuse; notes are worth saying but fine.
 */
import matter from "gray-matter";
import { parseNote } from "./parse-note";
import { readStatblocks } from "./statblock/extract-statblocks";

export const NOTE_KINDS = ["monster", "spell", "item"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface NoteCheck {
  problems: string[];
  notes: string[];
}

/** Spell frontmatter keys and the field each fills in (see `spellFields`). */
const SPELL_KEYS: Record<string, string> = {
  level: "level",
  school: "school",
  classes: "classes",
  casting_time: "castingTime",
  range: "range",
  components: "components",
  duration: "duration",
  concentration: "concentration",
  ritual: "ritual",
  attack: "attack",
  save: "save",
  roll: "roll",
  effect: "effect",
  area: "area",
};

export function checkNote(path: string, source: string, kind?: NoteKind): NoteCheck {
  const note = parseNote(path, source);
  const problems: string[] = [];
  const notes: string[] = [];

  if (note.frontmatterError) {
    problems.push(
      `The frontmatter can't be read, so the note is DM-only: ${note.frontmatterError}`,
    );
  }
  notes.push(
    note.visibility === "players"
      ? "Players can read this note."
      : "DM-only: players can't see it.",
  );
  if (kind === "spell" || kind === "item") {
    if (note.type !== kind) problems.push(`It needs \`type: ${kind}\` to be listed as ${a(kind)}.`);
  }

  const statblocks = readStatblocks(note.body);
  for (const result of statblocks) {
    if (!result.ok) {
      problems.push(`A statblock can't be read: ${result.error}`);
      continue;
    }
    const { name, numbers, challengeRating } = result.statblock;
    if (numbers.armorClass === undefined) problems.push(`${name} has no armour class (ac).`);
    if (numbers.hitPoints === undefined) problems.push(`${name} has no hit points (hp).`);
    if (challengeRating === undefined) notes.push(`${name} has no challenge rating (cr).`);
    notes.push(
      `Statblock ${name}: AC ${numbers.armorClass ?? "?"}, HP ${numbers.hitPoints ?? "?"}` +
        `${numbers.hitDice ? ` (${numbers.hitDice})` : ""}, initiative ${numbers.initiative}`,
    );
  }
  if (kind === "monster" && statblocks.length === 0) {
    problems.push("It has no ```statblock block, so the combat tracker won't find it.");
  }

  if (note.spell && !note.frontmatterError) {
    const data = matter(source, {}).data;
    const read = note.spell as unknown as Record<string, unknown>;
    const isRead = (field: string) => {
      const value = read[field];
      return Array.isArray(value) ? value.length > 0 : value !== undefined;
    };
    const filled = Object.entries(SPELL_KEYS).filter(([, field]) => isRead(field));
    notes.push(
      filled.length
        ? `The spell picker fills in: ${filled.map(([key]) => key).join(", ")}.`
        : "The spell picker fills in nothing: the player types the spell's details.",
    );
    for (const [key, field] of Object.entries(SPELL_KEYS)) {
      if (data[key] !== undefined && !isRead(field)) {
        problems.push(
          `\`${key}: ${String(data[key])}\` can't be read, so the picker leaves it out.`,
        );
      }
    }
  }

  return { problems, notes };
}

const a = (kind: NoteKind) => (kind === "item" ? "an item" : "a spell");
