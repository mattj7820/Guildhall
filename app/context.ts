import { createContext } from "react-router";
import type { PreparedEncounters } from "~/.server/combat/prepared-encounters";
import type { Config } from "~/.server/config";
import type { CampaignMaps } from "~/.server/maps/campaign-maps";
import type { LiveVault } from "~/.server/vault/live-vault";
import { DM_VIEWER, type Viewer } from "~/campaign/types";

/** Process-wide services, created once by the server and handed to every request. */
export interface Services {
  config: Config;
  vault: LiveVault;
  /** Combat encounters prepared ahead of a session, kept in the data folder. */
  preparedEncounters: PreparedEncounters;
  /** Interactive maps and their areas, kept in the data folder. */
  maps: CampaignMaps;
}

export const servicesContext = createContext<Services>();

/**
 * Who is making this request. Set by the root middleware from the view-mode cookie today;
 * the natural seam for real authentication later.
 */
export const viewerContext = createContext<Viewer>(DM_VIEWER);
