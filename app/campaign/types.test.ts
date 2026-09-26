import { describe, expect, it } from "vitest";
import { playerFromName } from "./types";

describe("playerFromName", () => {
  it("keeps the name for display and derives a case-insensitive ID", () => {
    expect(playerFromName("Sam")).toEqual({ id: "sam", name: "Sam" });
  });

  it("treats spacing and case differences as the same player", () => {
    expect(playerFromName("  Player   One ")?.id).toBe(playerFromName("player one")?.id);
  });

  it("returns undefined for a blank name", () => {
    expect(playerFromName("   ")).toBeUndefined();
  });
});
