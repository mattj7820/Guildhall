import type { Campaign } from "~/campaign/campaigns";
import type { Services } from "~/context";
import { prepareThumbnails } from "../maps/load";
import { LiveVault } from "../vault/live-vault";
import { openCampaignData } from "./campaign-data";

type Running = Omit<Services, "live"> & {
  live: Pick<Services["live"], "allMapsChanged" | "boardChanged" | "campaignChanged">;
};

/** Keeps what's made from the vault up to date as it changes. */
export function watchVault(services: Running): void {
  // A map's notes and image come from the vault, so any open map may look different now.
  services.vault.onReload(() => {
    void services.live.allMapsChanged();
    // Pinned notes' names, and whether players may see them, come from the vault.
    void services.live.boardChanged();
    void prepareThumbnails(services);
  });
  void prepareThumbnails(services);
}

let switching: Promise<unknown> = Promise.resolve();

/**
 * Makes the app the given campaign, while it runs: only its folder of the vault and its own
 * data. The services are changed in place, so every request from now on gets the campaign's, and
 * every page with a live connection reloads. One switch at a time.
 */
export function runCampaign(
  services: Running,
  campaign: Campaign,
  open: (folder?: string) => Promise<LiveVault> = (folder) =>
    LiveVault.open(services.config.vaultPath, { folder }),
): Promise<void> {
  const run = async () => {
    const vault = await open(campaign.folder);
    const old = services.vault;
    Object.assign(services, { vault, ...openCampaignData(services.config.dataPath, campaign) });
    watchVault(services);
    await old.close();
    services.live.campaignChanged();
    console.log(
      `[campaign] Running ${campaign.name ?? "the first campaign"}: ` +
        `${vault.current.notes({ role: "dm" }).length} notes`,
    );
  };
  const done = switching.then(run);
  switching = done.catch(() => undefined);
  return done;
}
