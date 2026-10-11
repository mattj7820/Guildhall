import { toHtml } from "hast-util-to-html";
import { playerFromName, type Viewer } from "~/campaign/types";
import {
  statblockKey,
  WHOLE_PARTY,
  type CombatCatalogue,
  type CreatureOption,
  type PartyMember,
  type StatblockView,
} from "~/combat/types";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import type { Vault } from "~/.server/vault/vault";
import { noteUrl } from "~/wiki/urls";

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * The statblocks and player characters the combat tracker can use, in shapes the browser can
 * hold. Statblocks themselves are loaded when they're shown (`statblockView`), so the page
 * carries only what's needed to find and add them.
 */
export function combatCatalogue(vault: Vault, viewer: Viewer): CombatCatalogue {
  const creatures = new Map<string, CreatureOption>();
  for (const { note, statblock } of vault.statblocks(viewer)) {
    const ref = { entityId: note.id, name: statblock.name };
    const key = statblockKey(ref);
    // Two statblocks with the same name in one note can't be told apart; the first wins.
    if (creatures.has(key)) continue;
    creatures.set(key, {
      key,
      ref,
      name: statblock.name,
      noteTitle: note.title,
      noteUrl: noteUrl(note.slug),
      armorClass: statblock.numbers.armorClass,
      hitPoints: statblock.numbers.hitPoints,
      hitDice: statblock.numbers.hitDice,
      ...(statblock.numbers.squares && { squares: statblock.numbers.squares }),
      initiativeBonus: statblock.numbers.initiative,
    });
  }

  return {
    creatures: [...creatures.values()].sort(
      (a, b) => byName.compare(a.name, b.name) || byName.compare(a.noteTitle, b.noteTitle),
    ),
    party: [
      ...vault.party(viewer).map((note): PartyMember => ({
        kind: "pc",
        entityId: note.id,
        name: note.title,
        noteUrl: noteUrl(note.slug),
        player: note.player ? playerFromName(note.player) : undefined,
      })),
      // The party's companions, with the statblock in their note.
      ...vault
        .notes(viewer)
        .filter((note) => note.type === "companion")
        .sort((a, b) => byName.compare(a.title, b.title))
        .map((note): PartyMember => {
          const statblock = [...creatures.values()].find((each) => each.ref.entityId === note.id);
          return {
            kind: "companion",
            entityId: note.id,
            name: note.title,
            noteUrl: noteUrl(note.slug),
            player: (note.player && playerFromName(note.player)) || WHOLE_PARTY,
            ...(statblock && { statblock: statblock.ref }),
          };
        }),
    ],
  };
}

/**
 * One statblock by its key, rendered with its rolls marked, if the viewer may see it. Rendered
 * each time, so an edit to the note shows the next time it's opened.
 */
export function statblockView(
  vault: Vault,
  viewer: Viewer,
  key: string,
): StatblockView | undefined {
  const found = vault
    .statblocks(viewer)
    .find(
      ({ note, statblock }) => statblockKey({ entityId: note.id, name: statblock.name }) === key,
    );
  return found && { html: toHtml(renderStatblock(found.statblock, { rollable: true })) };
}
