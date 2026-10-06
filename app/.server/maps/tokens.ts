import { DM_VIEWER, type EntityId, type Viewer } from "~/campaign/types";
import type { Controllers } from "~/characters/permissions";
import type { Character } from "~/characters/types";
import type { Services } from "~/context";
import type { FogMask } from "~/maps/fog/types";
import { canView } from "~/campaign/visibility";
import { characterAccess } from "~/characters/permissions";
import { descendants } from "~/maps/tree";
import type {
  InsideBadge,
  MapTokensView,
  MarkerToken,
  NoteChoice,
  PartyFace,
  PartyPlacement,
  TokenElsewhere,
  TokenTools,
  TokenView,
  Whereabouts,
} from "~/maps/tokens/types";
import {
  markerView,
  tokensForViewer,
  type PartyMember,
  type PictureOf,
} from "~/maps/tokens/visibility";
import { tokenPictureUrl } from "~/maps/urls";
import { assetUrl } from "~/wiki/urls";
import type { CampaignMap } from "~/maps/types";
import { controllersFor } from "../characters/controllers";
import { partyCards } from "../characters/load";
import type { Note } from "../vault/parse-note";
import type { Vault } from "../vault/vault";
import { linksSeen } from "./view";

/** PC and companion notes by ID, looked up as the DM would. */
function partyNotes(vault: Vault): Map<EntityId, Note> {
  return new Map(
    vault
      .notes(DM_VIEWER)
      .filter((note) => note.type === "pc" || note.type === "companion")
      .map((note) => [note.id, note]),
  );
}

/**
 * The image an NPC token shows when its picture is its note's: the note's first image, as the DM
 * sees it. Showing the token shows what the DM sees on it; the picture route serves it only to
 * those who may see the token.
 */
export function notePicture(vault: Vault, token: MarkerToken): string | undefined {
  const note = token.note === undefined ? undefined : vault.noteById(token.note, DM_VIEWER);
  return note && vault.firstImage(note, DM_VIEWER);
}

/**
 * The DM's Tokens tab: every note to link an NPC to (NPC notes first), with a preview of its
 * picture; markers elsewhere; and the maps a token can be sent to.
 */
export async function tokenTools(
  services: Pick<Services, "vault" | "tokens">,
  maps: readonly CampaignMap[],
  here: CampaignMap,
): Promise<TokenTools> {
  const vault = services.vault.current;
  const notes = vault
    .notes(DM_VIEWER)
    .map((note): NoteChoice => {
      const image = vault.firstImage(note, DM_VIEWER);
      return {
        id: note.id,
        slug: note.slug,
        title: note.title,
        npc: note.type === "npc",
        ...(image && { imageUrl: assetUrl(image) }),
      };
    })
    .sort((a, b) => Number(b.npc) - Number(a.npc) || a.title.localeCompare(b.title));
  return {
    notes,
    elsewhere: await tokensElsewhere(services, maps, here),
    otherMaps: maps
      .filter((map) => map.id !== here.id)
      .map((map) => ({ id: map.id, name: map.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** NPC pictures' URLs, by token: never the image's path or the note. */
export function picturesIn(vault: Vault): PictureOf {
  return (token) => {
    const image = token.picture === "note" ? notePicture(vault, token) : undefined;
    return image && tokenPictureUrl(token.map, token.id, image);
  };
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

type Deps = Pick<Services, "vault" | "characters" | "tokens" | "fogs" | "fight">;

/**
 * Who's inside each area of a map that leads to a deeper map, as this viewer may see them: the
 * party members on that map, or on maps inside it, whom they'd see there. Only through areas and
 * links they can see, so a badge never gives a hidden place away.
 */
export async function insideBadges(
  services: Deps,
  map: CampaignMap,
  maps: readonly CampaignMap[],
  viewer: Viewer,
  fog: FogMask,
): Promise<InsideBadge[]> {
  const links = linksSeen(map, maps, viewer, fog);
  if (links.length === 0) return [];
  const [tokens, characters] = await Promise.all([
    services.tokens.list(),
    services.characters.list(),
  ]);
  const party = partyFor(services.vault.current, characters, viewer);
  const order = partyCards(services.vault.current, characters, viewer).cards.map(
    (card) => card.name,
  );
  const badges: InsideBadge[] = [];
  for (const link of links) {
    const inside = [link.map, ...descendants(link.map, maps)];
    const members: PartyFace[] = [];
    for (const id of inside) {
      const on = maps.find((each) => each.id === id);
      const here = tokens.filter((token) => token.map === id && token.kind === "character");
      if (!on || !canView(viewer, on.visibility) || here.length === 0) continue;
      const { mask } = await services.fogs.get(on.id, on.image);
      for (const seen of tokensForViewer({ tokens: here, viewer, fog: mask, party })) {
        members.push({
          name: seen.name,
          ...(seen.portraitUrl && { portraitUrl: seen.portraitUrl }),
        });
      }
    }
    // In the party's usual order: PCs by name, then companions.
    members.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    if (members.length > 0) badges.push({ area: link.area, members });
  }
  return badges;
}

/** A map's tokens and who's inside its areas, as this viewer may see them. */
export async function loadMapTokens(
  services: Deps & Pick<Services, "maps">,
  map: CampaignMap,
  viewer: Viewer,
): Promise<MapTokensView> {
  const [maps, { mask }] = await Promise.all([
    services.maps.list(),
    services.fogs.get(map.id, map.image),
  ]);
  const [tokens, inside] = await Promise.all([
    loadTokens(services, map, viewer, mask),
    insideBadges(services, map, maps, viewer, mask),
  ]);
  return { tokens, inside };
}

/**
 * Where the party is, for the Maps page. Players get their own party members, on maps they may
 * open (or nowhere, if not); the DM, everyone.
 */
export async function whereabouts(
  services: Deps & Pick<Services, "maps">,
  viewer: Viewer,
): Promise<Whereabouts[]> {
  const [maps, tokens, characters] = await Promise.all([
    services.maps.list(),
    services.tokens.list(),
    services.characters.list(),
  ]);
  const vault = services.vault.current;
  const { cards } = partyCards(vault, characters, viewer);
  const controllers = partyControllers(vault);
  return cards.flatMap((card) => {
    const theirs = characterAccess(viewer, controllers(card.note)) === "edit";
    if (viewer.role !== "dm" && !theirs) return [];
    const token = tokens.find((each) => each.kind === "character" && each.note === card.note);
    const on = token && maps.find((each) => each.id === token.map);
    const shown = on && canView(viewer, on.visibility) ? { id: on.id, name: on.name } : undefined;
    return [
      {
        name: card.name,
        ...(card.portraitUrl && { portraitUrl: card.portraitUrl }),
        theirs: viewer.role !== "dm" && theirs,
        ...(shown && { map: shown }),
      },
    ];
  });
}

/** The tokens on a map as this viewer may see them. */
export async function loadTokens(
  services: Deps,
  map: CampaignMap,
  viewer: Viewer,
  fog?: FogMask,
): Promise<TokenView[]> {
  const [tokens, characters, mask, fight] = await Promise.all([
    services.tokens.onMap(map.id),
    services.characters.list(),
    fog ?? services.fogs.get(map.id, map.image).then((stored) => stored.mask),
    services.fight.get(),
  ]);
  return tokensForViewer({
    tokens,
    viewer,
    fog: mask,
    party: partyFor(services.vault.current, characters, viewer),
    fight,
    pictureOf: picturesIn(services.vault.current),
  });
}

/**
 * For the DM's Tokens tab: markers set aside (from any map), and NPCs (markers with a note) on
 * other maps, to bring here. Plain markers elsewhere belong to their own maps.
 */
export async function tokensElsewhere(
  services: Pick<Services, "vault" | "tokens">,
  maps: readonly CampaignMap[],
  here: CampaignMap,
): Promise<TokenElsewhere[]> {
  const pictureOf = picturesIn(services.vault.current);
  const markers = (await services.tokens.list()).filter(
    (token): token is MarkerToken =>
      token.kind === "marker" && (!!token.aside || (!!token.note && token.map !== here.id)),
  );
  return markers
    .map((token) => {
      const map = maps.find((each) => each.id === token.map);
      return {
        token: markerView(token, DM_VIEWER, true, pictureOf),
        ...(map && { map: { id: map.id, name: map.name } }),
        aside: !!token.aside,
      };
    })
    .sort((a, b) => a.token.name.localeCompare(b.token.name, undefined, { numeric: true }));
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
