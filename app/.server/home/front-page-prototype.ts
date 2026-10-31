/**
 * PROTOTYPE (throwaway, behind ?prototype=front): what the living front page shows, to judge the
 * layout with real data. The real slice gets its own tested modules.
 */
import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import { fightView } from "~/.server/combat/fight-view";
import { partyCards } from "~/.server/characters/load";
import { listMaps } from "~/.server/maps/maps-page";
import { loadTokens, partyControllers, whereabouts } from "~/.server/maps/tokens";
import { fightSummaryOf } from "~/home/fight-summary";
import type { ListedMap } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import { noteUrl } from "~/wiki/urls";

export interface BannerFace {
  name: string;
  portraitUrl?: string;
  at: [number, number];
}

export async function frontPagePrototype(services: Services, viewer: Viewer) {
  const vault = services.vault.current;
  const [party, maps, characters, fight] = await Promise.all([
    whereabouts(services, viewer),
    listMaps(services, viewer),
    services.characters.list(),
    services.fight.get(),
  ]);

  // Players: the map their own character is on. The DM: the one most of the party is on.
  const counts = new Map<string, number>();
  for (const member of party) {
    if (!member.map || (viewer.role !== "dm" && !member.theirs)) continue;
    counts.set(member.map.id, (counts.get(member.map.id) ?? 0) + 1);
  }
  const bannerId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const listed: ListedMap | undefined = maps.find((map) => map.id === bannerId);
  let faces: BannerFace[] = [];
  if (listed) {
    const map = await services.maps.get(listed.id);
    if (map) {
      const tokens = await loadTokens(services, map, viewer);
      faces = tokens
        .filter((token) => token.kind === "character" && !token.hidden)
        .map(({ name, portraitUrl, at }) => ({ name, at, ...(portraitUrl && { portraitUrl }) }));
    }
  }

  const online = services.live.online();
  const controllers = partyControllers(vault);
  const strip = partyCards(vault, characters, viewer).cards.map((card) => {
    const who = controllers(card.note);
    const players = typeof who === "object" ? who.players : [];
    return {
      name: card.name,
      kind: card.kind,
      portraitUrl: card.portraitUrl,
      blurb: [card.species, card.className, card.level && `level ${card.level}`]
        .filter(Boolean)
        .join(" · "),
      online: card.kind === "pc" && players.some((id) => online.players.has(id)),
    };
  });

  const sessions = vault
    .notes(viewer)
    .filter((note) => note.type === "session")
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const latest = sessions.at(-1);

  return {
    banner: listed && {
      name: listed.name,
      url: mapUrl(listed.id),
      thumbnail: listed.thumbnail,
      size: listed.size,
      faces,
    },
    party: strip,
    dmOnline: online.dm,
    latestSession: latest && { title: latest.title, url: noteUrl(latest.slug) },
    fight: fight ? fightSummaryOf(await fightView(services, fight, viewer)) : null,
  };
}
