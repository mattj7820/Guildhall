import { SRD_SOURCES } from "~/campaign/srd";
import { PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import {
  noteSpellKey,
  parseSpellKey,
  srdSpellKey,
  type SpellOption,
} from "~/characters/spell-options";
import type { Sheet } from "~/characters/types";
import type { SpellText } from "~/characters/view";
import { noteUrl } from "~/wiki/urls";
import { srdSpells, srdSpellText } from "../srd/spells";
import type { Note } from "../vault/parse-note";
import type { Vault } from "../vault/vault";

/**
 * Every spell this viewer may pick for a sheet: the SRD's, and the vault spell notes they may read
 * (a note players can't read is marked for the DM, and never there for players). No text: that's
 * loaded when a spell is opened.
 */
export function spellOptions(vault: Vault, viewer: Viewer): SpellOption[] {
  const notes = vault
    .notes(viewer)
    .filter((note) => note.type === "spell")
    .map((note) => noteOption(note, viewer));
  return [...notes, ...[...srdSpells().values()].map(({ option }) => option)];
}

function noteOption(note: Note, viewer: Viewer): SpellOption {
  const { classes = [], ...fields } = note.spell ?? {};
  return {
    key: noteSpellKey(note.id),
    name: note.title,
    castingTime: "",
    range: "",
    components: "",
    duration: "",
    concentration: false,
    ritual: false,
    attack: false,
    ...fields,
    classes,
    note: note.id,
    ...(viewer.role === "dm" && !canView(PLAYER_VIEWER, note.visibility)
      ? { hiddenFromPlayers: true as const }
      : {}),
  };
}

/**
 * One spell's text, by its key, as this viewer may read it: an SRD spell's, or a vault spell
 * note's without its DM parts for players. Undefined for one that isn't there or isn't theirs to
 * read, alike.
 */
export function spellText(vault: Vault, viewer: Viewer, key: string): SpellText | undefined {
  const parsed = parseSpellKey(key, SRD_SOURCES);
  if (!parsed) return undefined;
  if ("srd" in parsed) return srdSpellText(srdSpellKey(parsed.srd));
  const note = vault.noteById(parsed.note, viewer);
  if (note?.type !== "spell") return undefined;
  return { html: vault.render(note, viewer), source: note.title, url: noteUrl(note.slug) };
}

/** The text of the SRD spells a sheet links to, sent with it so a spell's details open at once. */
export function sheetSpellTexts(sheet: Sheet): Record<string, SpellText> {
  return Object.fromEntries(
    sheet.spells.flatMap(({ srd }) => {
      const key = srd && srdSpellKey(srd);
      const text = key && srdSpellText(key);
      return key && text ? [[key, text]] : [];
    }),
  );
}
