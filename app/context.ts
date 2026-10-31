import { createContext, type Cookie } from "react-router";
import type { Account } from "~/.server/auth/account";
import type { DiscordAuth } from "~/.server/auth/discord";
import type { Characters } from "~/.server/characters/characters";
import type { Sessions } from "~/.server/auth/sessions";
import type { Live } from "~/.server/live/live";
import type { CurrentFight } from "~/.server/combat/current-fight";
import type { NextSession } from "~/.server/home/next-session";
import type { PreparedEncounters } from "~/.server/combat/prepared-encounters";
import type { Config } from "~/.server/config";
import type { CampaignMaps } from "~/.server/maps/campaign-maps";
import type { MapFogs } from "~/.server/maps/map-fogs";
import type { MapTokens } from "~/.server/maps/map-tokens";
import type { PlayerImages } from "~/.server/maps/player-image";
import type { DiceCollections } from "~/.server/dice/collections";
import type { Members } from "~/.server/members/members";
import type { LiveVault } from "~/.server/vault/live-vault";
import { DM_VIEWER, type Viewer } from "~/campaign/types";

/** Process-wide services, created once by the server and handed to every request. */
export interface Services {
  config: Config;
  vault: LiveVault;
  /** The fight the table is in, kept in the data folder and shown to everyone. */
  fight: CurrentFight;
  /** When the table next meets, set by the DM, kept in the data folder. */
  nextSession: NextSession;
  /** Combat encounters prepared ahead of a session, kept in the data folder. */
  preparedEncounters: PreparedEncounters;
  /** Interactive maps and their areas, kept in the data folder. */
  maps: CampaignMaps;
  /** Each map's fog of war, kept in the data folder. */
  fogs: MapFogs;
  /** Party members' and the DM's tokens on maps, kept in the data folder. */
  tokens: MapTokens;
  /** What players get of map images: tiles with the fogged parts taken out. */
  playerImages: PlayerImages;
  /** Character sheets, shared companions and their bags, kept in the data folder. */
  characters: Characters;
  /** Everyone who has signed in, approved or waiting, kept in the data folder. */
  members: Members;
  /** Members' dice collections and unopened packs, kept in the data folder. */
  dice: DiceCollections;
  /** Live updates: websockets on the same server, signed in like pages. */
  live: Live;
  /** Signed session cookies. */
  sessions: Sessions;
  /** Remembers a Discord sign-in between leaving for Discord and coming back. */
  signInAttempts: Cookie;
  /** "Sign in with Discord", when a Discord application is set up. */
  discord?: DiscordAuth;
}

export const servicesContext = createContext<Services>();

/**
 * What this request may see. Set by the root middleware from who is signed in (and, for the DM,
 * the preview toggle); every visibility decision takes it.
 */
export const viewerContext = createContext<Viewer>(DM_VIEWER);

/** Who is signed in, if anyone. Set by the root middleware. */
export const accountContext = createContext<Account>({ kind: "anonymous" });

/** The address the request's connection came from, set by the server. Used for dev sign-in. */
export const clientAddressContext = createContext<string | undefined>(undefined);
