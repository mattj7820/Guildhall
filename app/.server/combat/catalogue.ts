import { toHtml } from "hast-util-to-html";
import { playerFromName, type Viewer } from "~/campaign/types";
import {
  statblockKey,
  WHOLE_PARTY,
  type CombatCatalogue,
  type CreatureOption,
  type PartyMember,
  type StatblockRef,
  type StatblockView,
} from "~/combat/types";
import { srdMonsters, srdStatblockView } from "~/.server/srd/monsters";
import type { Statblock } from "~/.server/vault/statblock/parse-statblock";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import type { Vault } from "~/.server/vault/vault";
import { noteUrl } from "~/wiki/urls";

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** With the same name: the vault's own first, then the 2024 rules, then 2014. */
const SOURCE_ORDER = { vault: 0, "srd-5.2": 1, "srd-5.1": 2 };
const sourceOrder = (creature: CreatureOption) => SOURCE_ORDER[creature.ref.source ?? "vault"];

function creatureOption(
  ref: StatblockRef,
  statblock: Statblock,
  note?: { title: string; url: string },
): CreatureOption {
  return {
    key: statblockKey(ref),
    ref,
    name: statblock.name,
    ...(note && { noteTitle: note.title, noteUrl: note.url }),
    ...(statblock.challengeRating && { challenge: statblock.challengeRating }),
    ...(statblock.size && { size: statblock.size }),
    ...(statblock.type && { type: statblock.type }),
    armorClass: statblock.numbers.armorClass,
    hitPoints: statblock.numbers.hitPoints,
    hitDice: statblock.numbers.hitDice,
    ...(statblock.numbers.squares && { squares: statblock.numbers.squares }),
    initiativeBonus: statblock.numbers.initiative,
  };
}

let srdOptions: CreatureOption[] | undefined;

/** The SRD's monsters never change while Guildhall runs, so their options are made once. */
function srdCreatures(): CreatureOption[] {
  srdOptions ??= [...srdMonsters().values()].map(({ ref, statblock }) =>
    creatureOption(ref, statblock),
  );
  return srdOptions;
}

/**
 * The statblocks and player characters the combat tracker can use, in shapes the browser can
 * hold: the vault's statblocks and the SRD's monsters, all by name. Statblocks themselves are
 * loaded when they're shown (`statblockView`), so the page carries only what's needed to find and
 * add them. Only ever built for the DM.
 */
export function combatCatalogue(vault: Vault, viewer: Viewer): CombatCatalogue {
  const creatures = new Map<string, CreatureOption>();
  for (const { note, statblock } of vault.statblocks(viewer)) {
    const ref = { entityId: note.id, name: statblock.name };
    // Two statblocks with the same name in one note can't be told apart; the first wins.
    if (creatures.has(statblockKey(ref))) continue;
    creatures.set(
      statblockKey(ref),
      creatureOption(ref, statblock, { title: note.title, url: noteUrl(note.slug) }),
    );
  }
  const vaultCreatures = [...creatures.values()];

  return {
    creatures: [...vaultCreatures, ...srdCreatures()].sort(
      (a, b) =>
        byName.compare(a.name, b.name) ||
        sourceOrder(a) - sourceOrder(b) ||
        byName.compare(a.noteTitle ?? "", b.noteTitle ?? ""),
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
          const statblock = vaultCreatures.find((each) => each.ref.entityId === note.id);
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
 * One statblock by its key, rendered with its rolls marked, if the viewer may see it. The vault's
 * are rendered each time, so an edit to the note shows the next time it's opened.
 */
export function statblockView(
  vault: Vault,
  viewer: Viewer,
  key: string,
): StatblockView | undefined {
  if (srdMonsters().has(key)) return srdStatblockView(key);
  const found = vault
    .statblocks(viewer)
    .find(
      ({ note, statblock }) => statblockKey({ entityId: note.id, name: statblock.name }) === key,
    );
  return found && { html: toHtml(renderStatblock(found.statblock, { rollable: true })) };
}
