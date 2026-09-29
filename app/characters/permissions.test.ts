import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { canGive, characterAccess, type Controllers } from "./permissions";

const sam: Viewer = { role: "player", playerId: "sam" };
const alex: Viewer = { role: "player", playerId: "alex" };

const samsPc: Controllers = { players: ["sam"] };
const companion: Controllers = "party";
const noteGone: Controllers = "unknown";

describe("characterAccess", () => {
  it.each<[string, Viewer, Controllers, string]>([
    ["the DM, any character", DM_VIEWER, samsPc, "edit"],
    ["the DM, a character whose note has gone", DM_VIEWER, noteGone, "edit"],
    ["a player, their own character", sam, samsPc, "edit"],
    ["a player, someone else's character", alex, samsPc, "summary"],
    ["a player, the party's companion", alex, companion, "edit"],
    ["a player, a character whose note has gone", sam, noteGone, "none"],
    ["the DM previewing as a player (no player ID)", PLAYER_VIEWER, samsPc, "summary"],
    ["a player not yet assigned, the party's companion", PLAYER_VIEWER, companion, "summary"],
  ])("%s: %s", (_, viewer, controllers, access) => {
    expect(characterAccess(viewer, controllers)).toBe(access);
  });

  it("lets every named player edit a character played by several", () => {
    const shared: Controllers = { players: ["sam", "alex"] };
    expect(characterAccess(sam, shared)).toBe("edit");
    expect(characterAccess(alex, shared)).toBe("edit");
  });
});

describe("canGive", () => {
  const alexsPc: Controllers = { players: ["alex"] };

  it("lets a player give from their own bag to anyone in the party", () => {
    expect(canGive(sam, samsPc, alexsPc)).toBe(true);
    expect(canGive(sam, samsPc, companion)).toBe(true);
  });

  it("never lets a player take from someone else's bag", () => {
    expect(canGive(sam, alexsPc, samsPc)).toBe(false);
  });

  it("doesn't let a player give to a character they can't see", () => {
    expect(canGive(sam, samsPc, noteGone)).toBe(false);
  });

  it("lets the DM give from anyone to anyone", () => {
    expect(canGive(DM_VIEWER, alexsPc, samsPc)).toBe(true);
  });
});
