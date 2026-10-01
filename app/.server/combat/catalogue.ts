import { toHtml } from "hast-util-to-html";
import { playerFromName, type Viewer } from "~/campaign/types";
import {
  statblockKey,
  WHOLE_PARTY,
  type CombatCatalogue,
  type CreatureOption,
  type PartyMember,
} from "~/combat/types";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import type { Vault } from "~/.server/vault/vault";
import { noteUrl } from "~/wiki/urls";

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * The statblocks and player characters the combat tracker can use, in shapes the browser can
 * hold. Statblocks go out pre-rendered, so the parser and renderer stay on the server.
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
      initiativeBonus: statblock.numbers.dexterityModifier,
      html: toHtml(renderStatblock(statblock, { rollable: true })),
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
