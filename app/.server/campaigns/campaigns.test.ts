import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAMPAIGN_NAME_MAX, FIRST_CAMPAIGN } from "~/campaign/campaigns";
import { Campaigns } from "./campaigns";

let folder: string;
let campaigns: Campaigns;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-campaigns-"));
  campaigns = Campaigns.inFolder(folder);
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const stored = async () => JSON.parse(await readFile(path.join(folder, "campaign.json"), "utf8"));

describe("Campaigns", () => {
  it("starts with the first campaign, unnamed, as the whole vault", async () => {
    expect(await campaigns.list()).toEqual([{ id: FIRST_CAMPAIGN }]);
    expect(await campaigns.active()).toEqual({ id: FIRST_CAMPAIGN });
  });

  it("reads a file from before campaigns as the first campaign", async () => {
    await writeFile(
      path.join(folder, "campaign.json"),
      '{"version":1,"name":"Fixture Campaign","folder":"Fixture Book"}',
    );
    expect(await campaigns.active()).toEqual({
      id: FIRST_CAMPAIGN,
      name: "Fixture Campaign",
      folder: "Fixture Book",
    });
  });

  it("keeps the first campaign's name where an older Guildhall reads it", async () => {
    await campaigns.rename(FIRST_CAMPAIGN, "  Fixture Campaign  ");
    await campaigns.setFolder(FIRST_CAMPAIGN, "Fixture Book");
    expect(await stored()).toEqual({
      version: 1,
      name: "Fixture Campaign",
      folder: "Fixture Book",
    });
    await campaigns.rename(FIRST_CAMPAIGN, "   ");
    await campaigns.setFolder(FIRST_CAMPAIGN, "");
    expect(await stored()).toEqual({ version: 1 });
  });

  it("cuts a name down to what fits on a cover", async () => {
    await campaigns.rename(FIRST_CAMPAIGN, "x".repeat(CAMPAIGN_NAME_MAX + 20));
    expect((await campaigns.active()).name).toHaveLength(CAMPAIGN_NAME_MAX);
  });

  it("adds campaigns, each in its own folder", async () => {
    await campaigns.setFolder(FIRST_CAMPAIGN, "Fixture One");
    const second = await campaigns.add("Fixture Two", "Fixture Two");
    expect(second).toMatchObject({ name: "Fixture Two", folder: "Fixture Two" });
    expect(await campaigns.add("Again", "Fixture Two")).toBe("folder-taken");
    expect(await campaigns.add("Again", "Fixture One")).toBe("folder-taken");
    expect((await campaigns.list()).map((campaign) => campaign.name)).toEqual([
      undefined,
      "Fixture Two",
    ]);
  });

  it("runs the campaign the DM makes active, and the first when that one is gone", async () => {
    const second = await campaigns.add("Fixture Two", "Fixture Two");
    if (typeof second === "string") throw new Error(second);
    await campaigns.activate(second.id);
    expect((await campaigns.active()).id).toBe(second.id);
    expect(await campaigns.activate("nope")).toBe("unknown");

    await writeFile(path.join(folder, "campaign.json"), '{"version":1,"active":"gone"}');
    expect((await campaigns.active()).id).toBe(FIRST_CAMPAIGN);
    await campaigns.activate(FIRST_CAMPAIGN);
    expect(await stored()).toEqual({ version: 1 });
  });

  it("renames and moves a later campaign, which always keeps a folder", async () => {
    const second = await campaigns.add("Fixture Two", "Fixture Two");
    if (typeof second === "string") throw new Error(second);
    await campaigns.rename(second.id, "Fixture Renamed");
    await campaigns.setFolder(second.id, "Fixture Moved");
    expect(await campaigns.setFolder(second.id, "")).toBe("unknown");
    expect((await campaigns.list())[1]).toEqual({
      id: second.id,
      name: "Fixture Renamed",
      folder: "Fixture Moved",
    });
  });

  it("leaves out what it can't understand, rather than refusing the file", async () => {
    await writeFile(
      path.join(folder, "campaign.json"),
      JSON.stringify({
        version: 1,
        name: 42,
        folder: [],
        others: [{ id: "../escape", folder: "X" }, { id: "a".repeat(32), folder: "Fixture" }, 7],
        active: {},
      }),
    );
    expect(await campaigns.list()).toEqual([
      { id: FIRST_CAMPAIGN },
      { id: "a".repeat(32), folder: "Fixture" },
    ]);
  });
});
