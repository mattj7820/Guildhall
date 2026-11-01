import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIRST_CAMPAIGN } from "~/campaign/campaigns";
import { campaignDataPath, openCampaignData } from "./campaign-data";

let dataPath: string;
beforeEach(async () => {
  dataPath = await mkdtemp(path.join(tmpdir(), "guildhall-campaign-data-"));
});
afterEach(() => rm(dataPath, { recursive: true, force: true }));

const second = { id: "b".repeat(32) };

describe("campaign data", () => {
  it("keeps the first campaign's data where it always was, and later ones' apart", () => {
    expect(campaignDataPath(dataPath, { id: FIRST_CAMPAIGN })).toBe(dataPath);
    expect(campaignDataPath(dataPath, second)).toBe(path.join(dataPath, "campaigns", second.id));
  });

  it("gives each campaign its own table", async () => {
    const first = openCampaignData(dataPath, { id: FIRST_CAMPAIGN });
    const other = openCampaignData(dataPath, second);
    await first.nextSession.set(new Date("2026-11-08T19:00:00Z"));

    expect(await first.nextSession.get()).toBe("2026-11-08T19:00:00.000Z");
    expect(await other.nextSession.get()).toBeUndefined();
    await other.nextSession.set(new Date("2026-11-09T19:00:00Z"));
    expect(await readdir(dataPath)).toEqual(["campaigns", "next-session.json"]);
    expect(await readdir(campaignDataPath(dataPath, second))).toEqual(["next-session.json"]);
  });
});
