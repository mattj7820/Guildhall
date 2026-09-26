import { createContext } from "react-router";
import type { Config } from "~/.server/config";
import type { LiveVault } from "~/.server/vault/live-vault";
import { DM_VIEWER, type Viewer } from "~/campaign/types";

/** Process-wide services, created once by the server and handed to every request. */
export interface Services {
  config: Config;
  vault: LiveVault;
}

export const servicesContext = createContext<Services>();

/**
 * Who is making this request. Set by the root middleware from the view-mode cookie today;
 * the natural seam for real authentication later.
 */
export const viewerContext = createContext<Viewer>(DM_VIEWER);
