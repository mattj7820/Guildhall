import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAMPAIGN_NAME_MAX, CampaignName } from "./campaign-name";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-campaign-name-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

describe("CampaignName", () => {
  it("has no name until the DM gives one", async () => {
    expect(await CampaignName.inFolder(folder).get()).toBeUndefined();
  });

  it("keeps the name in the data folder, trimmed, until it's cleared", async () => {
    await CampaignName.inFolder(folder).set("  Fixture Campaign  ");
    expect(await CampaignName.inFolder(folder).get()).toBe("Fixture Campaign");
    await CampaignName.inFolder(folder).set("   ");
    expect(await CampaignName.inFolder(folder).get()).toBeUndefined();
  });

  it("cuts a name down to what fits on a cover", async () => {
    await CampaignName.inFolder(folder).set("x".repeat(CAMPAIGN_NAME_MAX + 20));
    expect(await CampaignName.inFolder(folder).get()).toHaveLength(CAMPAIGN_NAME_MAX);
  });

  it("reads a name it can't understand as none, rather than refusing the file", async () => {
    await writeFile(path.join(folder, "campaign.json"), '{"version":1,"name":42}');
    expect(await CampaignName.inFolder(folder).get()).toBeUndefined();
  });
});
