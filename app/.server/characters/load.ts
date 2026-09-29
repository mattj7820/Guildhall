import { toHtml } from "hast-util-to-html";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { characterAccess } from "~/characters/permissions";
import type { Character } from "~/characters/types";
import { portraitUrl } from "~/characters/urls";
import type { CharacterCard, CharacterPage, OrphanCard } from "~/characters/view";
import { noteUrl } from "~/wiki/urls";
import type { Note } from "../vault/parse-note";
import { renderStatblock } from "../vault/statblock/rehype-statblocks";
import type { Vault } from "../vault/vault";
import { controllersFor } from "./controllers";

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * The party as this viewer may see it: every PC and companion note, with its character if it has
 * one. Players get a summary of characters they don't play, and nothing at all of a character
 * whose note has gone; the DM also gets those, to link them again.
 */
export function partyCards(
  vault: Vault,
  characters: readonly Character[],
  viewer: Viewer,
): { cards: CharacterCard[]; orphans: OrphanCard[] } {
  const notes = vault
    .notes(DM_VIEWER)
    .filter((note) => note.type === "pc" || note.type === "companion")
    .sort(
      (a, b) =>
        Number(a.type === "companion") - Number(b.type === "companion") ||
        byName.compare(a.title, b.title),
    );

  const cards: CharacterCard[] = [];
  for (const note of notes) {
    const kind = note.type === "pc" ? "pc" : "companion";
    const access = characterAccess(viewer, controllersFor(kind, note));
    if (access === "none") continue;
    const character = characters.find((candidate) => candidate.note === note.id);
    cards.push(card(vault, note, kind, character, viewer, access === "edit"));
  }

  const orphans =
    viewer.role === "dm"
      ? characters
          .filter((character) => !vault.noteById(character.note, DM_VIEWER))
          .map((character) => ({ id: character.id, name: nameOf(character), note: character.note }))
      : [];
  return { cards, orphans };
}

function card(
  vault: Vault,
  note: Note,
  kind: Character["kind"],
  character: Character | undefined,
  viewer: Viewer,
  canOpen: boolean,
): CharacterCard {
  const statblock = kind === "companion" ? companionStatblock(vault, note, viewer) : undefined;
  const base: CharacterCard = {
    kind,
    note: note.id,
    name: character ? nameOf(character, note) : note.title,
    canOpen: canOpen && !!character,
    canStart: canOpen && !character,
    equipped: [],
    ...(statblock && {
      armourClass: statblock.numbers.armorClass,
      speed: statblock.speed,
    }),
  };
  if (!character) return base;

  const portrait = portraitPath(vault, character, viewer);
  const hp = character.kind === "pc" ? character.sheet.hp : character.hp;
  return {
    ...base,
    id: character.id,
    ...(portrait && { portraitUrl: portraitUrl(character.id, portrait) }),
    ...(character.kind === "pc" && {
      species: character.sheet.species,
      className: character.sheet.className,
      level: character.sheet.level,
    }),
    equipped: character.inventory.items
      .filter((item) => item.equipped)
      .map(({ name, icon }) => ({ name, icon })),
    ...(canOpen && { hp }),
  };
}

/**
 * Vault item notes this viewer may put in a bag, and each as they may read it, for items' details:
 * players get the note without its DM parts; notes kept from them aren't there at all, so an item
 * linked to one shows only its own name and description (an unidentified item).
 */
export function itemCatalogue(
  vault: Vault,
  viewer: Viewer,
): Pick<CharacterPage, "catalogue" | "itemNotes"> {
  const notes = vault
    .notes(viewer)
    .filter((note) => note.type === "item")
    .sort((a, b) => byName.compare(a.title, b.title));
  const hidden = (note: Note) =>
    viewer.role === "dm" && !canView(PLAYER_VIEWER, note.visibility)
      ? { hiddenFromPlayers: true }
      : {};
  return {
    catalogue: notes.map((note) => ({ id: note.id, title: note.title, ...hidden(note) })),
    itemNotes: Object.fromEntries(
      notes.map((note) => [
        note.id,
        {
          title: note.title,
          url: noteUrl(note.slug),
          html: vault.render(note, viewer),
          ...hidden(note),
        },
      ]),
    ),
  };
}

/**
 * Everything the sheet page shows, for someone allowed to open the character. `party` is every
 * character, for whom items can be given to.
 */
export function characterPage(
  vault: Vault,
  character: Character,
  viewer: Viewer,
  party: readonly Character[] = [],
): CharacterPage {
  const note = vault.noteById(character.note, DM_VIEWER);
  const readable = vault.noteById(character.note, viewer);
  const portrait = portraitPath(vault, character, viewer);
  const statblock =
    character.kind === "companion" && note ? companionStatblock(vault, note, viewer) : undefined;
  const fromNote = notePortrait(vault, character, viewer);
  return {
    character,
    name: nameOf(character, note),
    ...(portrait && { portraitUrl: portraitUrl(character.id, portrait) }),
    ...(fromNote && { notePortrait: fromNote }),
    ...(character.kind === "pc" && { portraitChoices: portraitChoices(vault, viewer) }),
    ...itemCatalogue(vault, viewer),
    recipients: partyCards(vault, party, viewer).cards.flatMap(({ id, name, kind }) =>
      id && id !== character.id
        ? [{ id, name, ...(kind === "companion" && { companion: true }) }]
        : [],
    ),
    // The DM's additions to anyone's bag are gifts.
    ...(viewer.role === "dm" && { givingAs: "the DM" }),
    ...(readable && {
      story: {
        title: readable.title,
        url: noteUrl(readable.slug),
        html: vault.render(readable, viewer),
      },
    }),
    ...(statblock && {
      statblockHtml: toHtml(renderStatblock(statblock)),
      speed: statblock.speed,
      armourClass: statblock.numbers.armorClass,
    }),
  };
}

/**
 * The image to show as a character's portrait: the one chosen on the sheet, if this viewer may
 * load it anyway, or else the first image in its note as this viewer may read the note. So it's
 * never an image from a DM part, a hidden note, or one chosen that the viewer couldn't see.
 */
export function portraitPath(
  vault: Vault,
  character: Character,
  viewer: Viewer,
): string | undefined {
  const chosen = character.kind === "pc" ? character.sheet.portrait : undefined;
  if (chosen && vault.getAsset(chosen, viewer)) return chosen;
  return notePortrait(vault, character, viewer);
}

/** The first image in the character's note, as this viewer may read it. */
function notePortrait(vault: Vault, character: Character, viewer: Viewer): string | undefined {
  const note = vault.noteById(character.note, viewer);
  return note && vault.firstImage(note, viewer);
}

/** Images this viewer may choose as a portrait: those they could load anyway. */
export function portraitChoices(vault: Vault, viewer: Viewer): string[] {
  return vault
    .mapImages()
    .filter((path) => vault.getAsset(path, viewer))
    .sort((a, b) => byName.compare(a, b));
}

/** The sheet's own name, the note's title, or a placeholder. */
export function nameOf(character: Character, note?: Note): string {
  const typed = character.kind === "pc" ? character.sheet.name.trim() : "";
  return typed || note?.title || "Unnamed character";
}

/** A companion's first statblock, as this viewer may see it. */
function companionStatblock(vault: Vault, note: Note, viewer: Viewer) {
  return vault.statblocks(viewer).find((entry) => entry.note.id === note.id)?.statblock;
}
