import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FIRST_CAMPAIGN } from "~/campaign/campaigns";
import { DM_VIEWER } from "~/campaign/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Vault } from "../vault/vault";
import { openCampaignData, type CampaignData } from "./campaign-data";
import { leftOutOf } from "./left-out";

let vault: Vault;
let dataPath: string;
let data: CampaignData;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});
beforeEach(async () => {
  dataPath = await mkdtemp(path.join(tmpdir(), "guildhall-left-out-"));
  data = openCampaignData(dataPath, { id: FIRST_CAMPAIGN });
});
afterEach(() => rm(dataPath, { recursive: true, force: true }));

const mira = () => vault.getNote("NPCs/Mira Stonehand", DM_VIEWER)!.id;

describe("leftOutOf", () => {
  it("lists maps' images and notes kept outside the folder, by the DM's names", async () => {
    await data.maps.create({
      name: "Fixture Map",
      image: { path: "Maps/Fixture Town.png", width: 100, height: 100 },
      note: mira(),
    });

    expect(await leftOutOf(data, vault, "Maps")).toEqual(["The map “Fixture Map”: its note"]);
    expect(await leftOutOf(data, vault, "NPCs")).toEqual(["The map “Fixture Map”: its image"]);
  });

  it("lists nothing for the whole vault, or when everything's inside", async () => {
    await data.maps.create({
      name: "Fixture Map",
      image: { path: "Maps/Fixture Town.png", width: 100, height: 100 },
    });
    expect(await leftOutOf(data, vault, undefined)).toEqual([]);
    expect(await leftOutOf(data, vault, "Maps")).toEqual([]);
  });
});
