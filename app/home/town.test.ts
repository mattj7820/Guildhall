import { describe, expect, it } from "vitest";
import { placeOf, STAND, townPlaces } from "./town";

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

describe("placeOf", () => {
  it("stands the token at the place for the page's module", () => {
    expect(placeOf("/wiki/NPCs/Someone")).toBe("library");
    expect(placeOf("/maps/abc/edit")).toBe("tower");
    expect(placeOf("/combat")).toBe("war");
    expect(placeOf("/characters/x")).toBe("barracks");
    expect(placeOf("/settings/dice")).toBe("treasury");
    expect(placeOf("/members")).toBe("steward");
  });

  it("uses the hall for pages without a place, and leaves it be on the front page", () => {
    expect(placeOf("/settings")).toBe("hall");
    expect(placeOf("/credits")).toBe("hall");
    expect(placeOf("/wikipedia")).toBe("hall");
    expect(placeOf("/")).toBeUndefined();
  });
});
