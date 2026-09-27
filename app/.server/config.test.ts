import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_VAULT } from "../../tests/support/fixture-vault";
import { ConfigError, loadConfig } from "./config";

describe("loadConfig", () => {
  it("resolves the vault path to an absolute path", () => {
    const config = loadConfig({ VAULT_PATH: path.relative(process.cwd(), FIXTURE_VAULT) });
    expect(config.vaultPath).toBe(FIXTURE_VAULT);
  });

  it("reads an optional Roll20 URL", () => {
    const url = "https://app.roll20.net/campaigns/details/123/example";
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT, ROLL20_CAMPAIGN_URL: url })).toMatchObject({
      roll20CampaignUrl: url,
    });
  });

  it("keeps its own data in ./data by default", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).dataPath).toBe(path.resolve("data"));
  });

  it("reads a data folder that doesn't exist yet", () => {
    const dataPath = path.resolve("test-results", "not-created-yet");
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: dataPath }).dataPath).toBe(dataPath);
  });

  it("treats an empty Roll20 URL as not configured", () => {
    expect(
      loadConfig({ VAULT_PATH: FIXTURE_VAULT, ROLL20_CAMPAIGN_URL: "" }).roll20CampaignUrl,
    ).toBeUndefined();
  });

  it.each([
    ["VAULT_PATH is missing", {}, /VAULT_PATH is not set/],
    ["VAULT_PATH is blank", { VAULT_PATH: "  " }, /VAULT_PATH is not set/],
    ["VAULT_PATH does not exist", { VAULT_PATH: "./no/such/folder" }, /does not point to a folder/],
    [
      "VAULT_PATH is a file",
      { VAULT_PATH: path.join(FIXTURE_VAULT, "Home.md") },
      /does not point to a folder/,
    ],
    [
      "the data folder is inside the vault",
      { VAULT_PATH: FIXTURE_VAULT, DATA_PATH: path.join(FIXTURE_VAULT, "Guildhall") },
      /must not overlap/,
    ],
    [
      "the data folder is the vault",
      { VAULT_PATH: FIXTURE_VAULT, DATA_PATH: FIXTURE_VAULT },
      /must not overlap/,
    ],
    [
      "the vault is inside the data folder",
      { VAULT_PATH: FIXTURE_VAULT, DATA_PATH: path.dirname(FIXTURE_VAULT) },
      /must not overlap/,
    ],
    [
      "the data folder is a file",
      { VAULT_PATH: FIXTURE_VAULT, DATA_PATH: path.resolve("package.json") },
      /points to a file/,
    ],
    [
      "the Roll20 URL is not a URL",
      { VAULT_PATH: FIXTURE_VAULT, ROLL20_CAMPAIGN_URL: "roll20" },
      /ROLL20_CAMPAIGN_URL/,
    ],
    [
      "the Roll20 URL is not http(s)",
      { VAULT_PATH: FIXTURE_VAULT, ROLL20_CAMPAIGN_URL: "javascript:alert(1)" },
      /ROLL20_CAMPAIGN_URL/,
    ],
  ])("fails clearly when %s", (_label, env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
