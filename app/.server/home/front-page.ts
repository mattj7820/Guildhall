import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import { fightView } from "~/.server/combat/fight-view";
import { partyCards } from "~/.server/characters/load";
import { DataFileError } from "~/.server/data/json-store";
import { listMaps } from "~/.server/maps/maps-page";
import { loadTokens, whereabouts } from "~/.server/maps/tokens";
import { presenceFor } from "./presence";
import {
  bannerMap,
  fightSummary,
  latestSession,
  type Banner,
  type FrontPage,
  type PartyMember,
} from "~/home/front-page";
import { mapUrl } from "~/maps/urls";
import { noteUrl } from "~/wiki/urls";

/**
 * The front page for one viewer: where the party is (the banner shows only maps and tokens the
 * viewer may see, and a player's thumbnail is the fogged one), the party, the latest session note
 * they may read, and the fight.
 */
export async function frontPage(services: Services, viewer: Viewer): Promise<FrontPage> {
  const vault = services.vault.current;
  const [banner, characters, fight, nextSession, online] = await Promise.all([
    // A data file that can't be read just leaves the banner out; its own page says why.
    loadBanner(services, viewer).catch((error: unknown) => {
      if (error instanceof DataFileError) return undefined;
      throw error;
    }),
    services.characters.list(),
    services.fight.get(),
    services.nextSession.get(),
    presenceFor(services, viewer, services.live.online()),
  ]);
  const party = partyCards(vault, characters, viewer).cards.map((card): PartyMember => ({
    name: card.name,
    kind: card.kind,
    ...(card.portraitUrl && { portraitUrl: card.portraitUrl }),
    blurb: [card.species, card.className, card.level && `level ${card.level}`]
      .filter(Boolean)
      .join(" · "),
  }));
  const session = latestSession(vault.notes(viewer).filter((note) => note.type === "session"));
  return {
    ...(banner && { banner }),
    party,
    online,
    ...(session && { latestSession: { title: session.title, url: noteUrl(session.slug) } }),
    ...(nextSession && { nextSession }),
    fight: fight ? fightSummary(await fightView(services, fight, viewer)) : null,
  };
}

async function loadBanner(services: Services, viewer: Viewer): Promise<Banner | undefined> {
  const party = await whereabouts(services, viewer);
  const id = bannerMap(party, viewer.role === "dm");
  const map = id && (await services.maps.get(id));
  if (!map) return undefined;
  const listed = (await listMaps(services, viewer)).find((each) => each.id === map.id);
  if (!listed) return undefined;
  const tokens = await loadTokens(services, map, viewer);
  return {
    name: map.name,
    url: mapUrl(map.id),
    ...(listed.thumbnail && { thumbnail: listed.thumbnail }),
    size: listed.size,
    faces: tokens
      .filter((token) => token.kind === "character")
      .map(({ name, portraitUrl, at }) => ({ name, at, ...(portraitUrl && { portraitUrl }) })),
  };
}
