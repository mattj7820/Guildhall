import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_CAMPAIGN } from "~/campaign/campaigns";
import { DM_VIEWER } from "~/campaign/types";
import type { Services } from "~/context";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { LiveVault } from "../vault/live-vault";
import { openCampaignData } from "./campaign-data";
import { runCampaign } from "./run";

let dataPath: string;
let services: Services;
beforeEach(async () => {
  dataPath = await mkdtemp(path.join(tmpdir(), "guildhall-run-campaign-"));
  services = {
    config: { vaultPath: FIXTURE_VAULT, dataPath },
    vault: await LiveVault.open(FIXTURE_VAULT, { watchForChanges: false }),
    live: { allMapsChanged: vi.fn(), campaignChanged: vi.fn() },
    ...openCampaignData(dataPath, { id: FIRST_CAMPAIGN }),
  } as unknown as Services;
});
afterEach(async () => {
  await services.vault.close();
  await rm(dataPath, { recursive: true, force: true });
});

const open = (folder?: string) => LiveVault.open(FIXTURE_VAULT, { folder, watchForChanges: false });

describe("runCampaign", () => {
  it("switches the running services to the campaign's folder and data, and reloads pages", async () => {
    const before = services;
    await services.nextSession.set(new Date("2026-11-08T19:00:00Z"));

    await runCampaign(services, { id: "c".repeat(32), folder: "NPCs" }, open);

    expect(services).toBe(before);
    expect(services.vault.folder).toBe("NPCs");
    expect(
      services.vault.current.notes(DM_VIEWER).every((note) => note.path.startsWith("NPCs/")),
    ).toBe(true);
    expect(await services.nextSession.get()).toBeUndefined();
    expect(services.live.campaignChanged).toHaveBeenCalledTimes(1);

    await runCampaign(services, { id: FIRST_CAMPAIGN }, open);
    expect(services.vault.folder).toBeUndefined();
    expect(await services.nextSession.get()).toBe("2026-11-08T19:00:00.000Z");
  });
});
