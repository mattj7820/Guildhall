import path from "node:path";
import { FIRST_CAMPAIGN, type Campaign } from "~/campaign/campaigns";
import { Characters } from "../characters/characters";
import { CurrentFight } from "../combat/current-fight";
import { PreparedEncounters } from "../combat/prepared-encounters";
import { NextSession } from "../home/next-session";
import { CampaignMaps } from "../maps/campaign-maps";
import { MapFogs } from "../maps/map-fogs";
import { MapTokens } from "../maps/map-tokens";

/**
 * Guildhall's own data about one campaign: what's about its notes and its table. Members, dice,
 * sign-ins and the image cache are everyone's, and stay in the data folder itself.
 */
export interface CampaignData {
  fight: CurrentFight;
  nextSession: NextSession;
  preparedEncounters: PreparedEncounters;
  maps: CampaignMaps;
  fogs: MapFogs;
  tokens: MapTokens;
  characters: Characters;
}

/**
 * Where a campaign's data is kept. The first campaign's stays in the data folder, where it was
 * before there were campaigns (so an older Guildhall still finds it); each later one has its own.
 */
export function campaignDataPath(dataPath: string, campaign: Pick<Campaign, "id">): string {
  return campaign.id === FIRST_CAMPAIGN ? dataPath : path.join(dataPath, "campaigns", campaign.id);
}

export function openCampaignData(dataPath: string, campaign: Pick<Campaign, "id">): CampaignData {
  const folder = campaignDataPath(dataPath, campaign);
  return {
    fight: CurrentFight.inFolder(folder),
    nextSession: NextSession.inFolder(folder),
    preparedEncounters: PreparedEncounters.inFolder(folder),
    maps: CampaignMaps.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    tokens: MapTokens.inFolder(folder),
    characters: Characters.inFolder(folder),
  };
}
