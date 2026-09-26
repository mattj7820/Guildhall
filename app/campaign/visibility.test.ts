import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "./types";
import { canView, parseVisibility } from "./visibility";

describe("parseVisibility", () => {
  it("accepts an explicit players value", () => {
    expect(parseVisibility("players")).toBe("players");
  });

  it("is case- and whitespace-tolerant", () => {
    expect(parseVisibility("  Players ")).toBe("players");
  });

  it.each([
    ["missing", undefined],
    ["explicit dm", "dm"],
    ["a typo", "player"],
    ["a non-string", ["players"]],
    ["null", null],
  ])("fails closed to dm when the value is %s", (_label, raw) => {
    expect(parseVisibility(raw)).toBe("dm");
  });
});

describe("canView", () => {
  it("lets the DM see everything", () => {
    expect(canView(DM_VIEWER, "dm")).toBe(true);
    expect(canView(DM_VIEWER, "players")).toBe(true);
  });

  it("only lets players see player-visible content", () => {
    expect(canView(PLAYER_VIEWER, "players")).toBe(true);
    expect(canView(PLAYER_VIEWER, "dm")).toBe(false);
  });
});
