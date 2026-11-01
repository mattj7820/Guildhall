import { describe, expect, it } from "vitest";
import { STAND, townPlaces } from "./town";

describe("townPlaces", () => {
  it("keeps the Steward's Office (Members) for the DM", () => {
    expect(townPlaces("dm").map((place) => place.id)).toContain("steward");
    expect(townPlaces("player").map((place) => place.id)).not.toContain("steward");
  });

  it("has a way to every place from where the viewer stands in the hall", () => {
    for (const place of townPlaces("dm").filter((each) => each.id !== "hall")) {
      expect(place.route, place.id).toMatch(new RegExp(`^M${STAND.x},${STAND.y} `));
    }
  });
});
