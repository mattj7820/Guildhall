import { DM_VIEWER, type EntityId, type Viewer } from "~/campaign/types";
import type { Controllers } from "~/characters/permissions";
import type { Character } from "~/characters/types";
import type { Services } from "~/context";
import type { FogMask } from "~/maps/fog/types";
import type { PartyPlacement, TokenView } from "~/maps/tokens/types";
import { tokensForViewer, type PartyMember } from "~/maps/tokens/visibility";
import type { CampaignMap } from "~/maps/types";
import { controllersFor } from "../characters/controllers";
import { partyCards } from "../characters/load";
import type { Note } from "../vault/parse-note";
import type { Vault } from "../vault/vault";

/** PC and companion notes by ID, looked up as the DM would. */
function partyNotes(vault: Vault): Map<EntityId, Note> {
  return new Map(
    vault
      .notes(DM_VIEWER)
      .filter((note) => note.type === "pc" || note.type === "companion")
      .map((note) => [note.id, note]),
  );
}

/** Who plays a party member, from their note; unknown for anything that isn't one. */
export function partyControllers(vault: Vault): (note: EntityId) => Controllers {
  const notes = partyNotes(vault);
  return (id) => {
    const note = notes.get(id);
    return note ? controllersFor(note.type === "pc" ? "pc" : "companion", note) : "unknown";
  };
}

/**
 * Party members as this viewer may know them: the name and portrait their party card would show,
 * or nothing for someone they may not know of.
 */
export function partyFor(
  vault: Vault,
  characters: readonly Character[],
  viewer: Viewer,
): (note: EntityId) => PartyMember | undefined {
  const { cards } = partyCards(vault, characters, viewer);
  const controllers = partyControllers(vault);
  return (note) => {
    const card = cards.find((each) => each.note === note);
    return (
      card && {
        name: card.name,
        ...(card.portraitUrl && { portraitUrl: card.portraitUrl }),
        controllers: controllers(note),
      }
    );
  };
}

type Deps = Pick<Services, "vault" | "characters" | "tokens" | "fogs">;

/** The tokens on a map as this viewer may see them. */
export async function loadTokens(
  services: Deps,
  map: CampaignMap,
  viewer: Viewer,
  fog?: FogMask,
): Promise<TokenView[]> {
  const [tokens, characters, mask] = await Promise.all([
    services.tokens.onMap(map.id),
    services.characters.list(),
    fog ?? services.fogs.get(map.id, map.image).then((stored) => stored.mask),
  ]);
  return tokensForViewer({
    tokens,
    viewer,
    fog: mask,
    party: partyFor(services.vault.current, characters, viewer),
  });
}

/** The whole party, for the DM to place: every PC and companion, and which map each is on. */
export async function partyPlacements(
  services: Deps,
  maps: readonly CampaignMap[],
): Promise<PartyPlacement[]> {
  const [tokens, characters] = await Promise.all([
    services.tokens.list(),
    services.characters.list(),
  ]);
  const { cards } = partyCards(services.vault.current, characters, DM_VIEWER);
  return cards.map((card) => {
    const token = tokens.find((each) => each.kind === "character" && each.note === card.note);
    const map = token && maps.find((each) => each.id === token.map);
    return {
      note: card.note,
      name: card.name,
      ...(card.portraitUrl && { portraitUrl: card.portraitUrl }),
      ...(map && { on: { id: map.id, name: map.name } }),
    };
  });
}
