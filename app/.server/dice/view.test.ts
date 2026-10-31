import { describe, expect, it } from "vitest";
import { ownedView } from "./view";

describe("ownedView", () => {
  it("lists dice by type, rarest first, leaving out styles no longer in the app", () => {
    const view = ownedView([
      { style: "bone", sides: 20, count: 2 },
      { style: "gilded", sides: 20, count: 1 },
      { style: "glass", sides: 4, count: 1 },
      { style: "a style from the future", sides: 6, count: 1 },
    ]);
    expect(view.map((die) => [die.style.id, die.sides, die.count])).toEqual([
      ["glass", 4, 1],
      ["gilded", 20, 1],
      ["bone", 20, 2],
    ]);
  });
});
