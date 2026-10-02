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

  it("takes the sound board's folder, Sounds by default, tidied of slashes", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).soundsFolder).toBe("Sounds");
    const folder = (value: string) =>
      loadConfig({ VAULT_PATH: FIXTURE_VAULT, SOUNDS_FOLDER: value }).soundsFolder;
    expect(folder("/Audio/Table/")).toBe("Audio/Table");
    expect(folder("Audio\\Table")).toBe("Audio/Table");
  });

  it("refuses a sound board folder outside the vault", () => {
    for (const value of ["../Elsewhere", "/", "Sounds/../.."]) {
      expect(() => loadConfig({ VAULT_PATH: FIXTURE_VAULT, SOUNDS_FOLDER: value })).toThrow(
        ConfigError,
      );
    }
  });

  it("reads a data folder that doesn't exist yet", () => {
    const dataPath = path.resolve("test-results", "not-created-yet");
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: dataPath }).dataPath).toBe(dataPath);
  });

  it("is reached at localhost on its port unless told otherwise", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).publicUrl).toBe("http://localhost:3000");
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT, PORT: "4173" }).publicUrl).toBe(
      "http://localhost:4173",
    );
  });

  it("reads its public address as an origin", () => {
    const config = loadConfig({
      VAULT_PATH: FIXTURE_VAULT,
      PUBLIC_URL: "https://Guildhall.Example.com/",
      SESSION_SECRET: "x".repeat(32),
    });
    expect(config.publicUrl).toBe("https://guildhall.example.com");
  });

  it("trusts no proxy unless told how many there are", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).trustProxy).toBe(0);
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT, TRUST_PROXY: "1" }).trustProxy).toBe(1);
  });

  it("reads session secrets and DM Discord IDs as comma-separated lists", () => {
    const secret = "x".repeat(32);
    const config = loadConfig({
      VAULT_PATH: FIXTURE_VAULT,
      SESSION_SECRET: `${secret}, ${"y".repeat(40)}`,
      DM_DISCORD_IDS: "123456789012345678,234567890123456789",
    });
    expect(config.sessionSecrets).toEqual([secret, "y".repeat(40)]);
    expect(config.dmDiscordIds).toEqual(["123456789012345678", "234567890123456789"]);
  });

  it("reads the Discord application, if there is one", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).discord).toBeUndefined();
    expect(
      loadConfig({
        VAULT_PATH: FIXTURE_VAULT,
        DISCORD_CLIENT_ID: "1234",
        DISCORD_CLIENT_SECRET: "shh",
      }).discord,
    ).toEqual({ clientId: "1234", clientSecret: "shh" });
  });

  it.each([[{ DISCORD_CLIENT_ID: "1234" }], [{ DISCORD_CLIENT_SECRET: "shh" }]])(
    "refuses half a Discord application: %j",
    (discord) => {
      expect(() => loadConfig({ VAULT_PATH: FIXTURE_VAULT, ...discord })).toThrow(
        /Set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET/,
      );
    },
  );

  it("has dev sign-in off unless asked for, and allows it on this computer", () => {
    expect(loadConfig({ VAULT_PATH: FIXTURE_VAULT }).devLogin).toBe(false);
    expect(
      loadConfig({
        VAULT_PATH: FIXTURE_VAULT,
        DEV_LOGIN: "true",
        PUBLIC_URL: "http://127.0.0.1:3000",
      }).devLogin,
    ).toBe(true);
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
    [
      "the public address has a path",
      { VAULT_PATH: FIXTURE_VAULT, PUBLIC_URL: "https://example.com/guildhall" },
      /PUBLIC_URL must be just the address/,
    ],
    [
      "the public address is not http(s)",
      { VAULT_PATH: FIXTURE_VAULT, PUBLIC_URL: "ftp://example.com" },
      /PUBLIC_URL must be an http\(s\) URL/,
    ],
    [
      "the proxy count is not a number",
      { VAULT_PATH: FIXTURE_VAULT, TRUST_PROXY: "true" },
      /TRUST_PROXY must be the number of proxies/,
    ],
    [
      "the proxy count is negative",
      { VAULT_PATH: FIXTURE_VAULT, TRUST_PROXY: "-1" },
      /TRUST_PROXY must be the number of proxies/,
    ],
    [
      "dev sign-in is on for a hosted address",
      {
        VAULT_PATH: FIXTURE_VAULT,
        DEV_LOGIN: "true",
        PUBLIC_URL: "https://guildhall.example.com",
        SESSION_SECRET: "x".repeat(32),
      },
      /DEV_LOGIN is for local development only/,
    ],
    [
      "dev sign-in is misspelt",
      { VAULT_PATH: FIXTURE_VAULT, DEV_LOGIN: "yes" },
      /DEV_LOGIN must be true or false/,
    ],
    [
      "a session secret is too short",
      { VAULT_PATH: FIXTURE_VAULT, SESSION_SECRET: "short" },
      /SESSION_SECRET must be at least 32 characters/,
    ],
    [
      "there's no session secret for an HTTPS address",
      { VAULT_PATH: FIXTURE_VAULT, PUBLIC_URL: "https://guildhall.example.com" },
      /SESSION_SECRET must be set/,
    ],
    [
      "a DM ID isn't a Discord ID",
      { VAULT_PATH: FIXTURE_VAULT, DM_DISCORD_IDS: "mattj" },
      /DM_DISCORD_IDS must be Discord user IDs/,
    ],
  ])("fails clearly when %s", (_label, env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
