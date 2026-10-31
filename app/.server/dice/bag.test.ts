import { describe, expect, it } from "vitest";
import { stylesForThrow } from "~/dice/bag";
import type { OwnedDie } from "~/dice/collection";
import { diceBag } from "./bag";
import { everyDie } from "./collections";

const d20s = (style: string, count: number): OwnedDie => ({ style, sides: 20, count });
const ids = (styles: ReturnType<typeof stylesForThrow>) => styles.map((style) => style?.id);
const rolled = (...sides: number[]) => sides.map((each) => ({ sides: each }));

describe("diceBag", () => {
  it("picks up their favourite first, then their rarest", () => {
    // Bone is uncommon, Glass rare, Gilded very rare.
    const owned = [d20s("bone", 2), d20s("glass", 1), d20s("gilded", 1)];
    expect(diceBag(owned, []).byType[20]).toEqual(["gilded", "glass", "bone", "bone"]);
    expect(diceBag(owned, [{ sides: 20, style: "bone" }]).byType[20]).toEqual([
      "bone",
      "bone",
      "gilded",
      "glass",
    ]);
  });

  it("uses the set picked before packs as a favourite, until they choose one", () => {
    const owned = [d20s("bone", 1), d20s("glass", 1)];
    expect(diceBag(owned, [], "bone").byType[20]?.[0]).toBe("bone");
    expect(diceBag(owned, [{ sides: 20, style: "glass" }], "bone").byType[20]?.[0]).toBe("glass");
    // Choosing none: the rarest first, Glass.
    expect(diceBag(owned, [{ sides: 20, style: "" }], "bone").byType[20]?.[0]).toBe("glass");
  });

  it("ignores a favourite they don't have", () => {
    expect(diceBag([d20s("bone", 1)], [{ sides: 20, style: "glass" }]).byType[20]).toEqual([
      "bone",
    ]);
  });

  it("sends only the styles they have, and at most a roll's worth of each type", () => {
    const bag = diceBag(everyDie(), []);
    expect(bag.byType[6]).toHaveLength(10);
    expect(diceBag([d20s("bone", 1)], []).styles.map((style) => style.id)).toEqual(["bone"]);
    expect(diceBag([], [])).toEqual({ styles: [], byType: {} });
  });
});

describe("stylesForThrow", () => {
  const bag = diceBag(
    [d20s("bone", 1), d20s("glass", 1), { style: "blood", sides: 6, count: 1 }],
    [{ sides: 20, style: "bone" }],
  );

  it("gives each die of a type the next of that type in the bag", () => {
    expect(ids(stylesForThrow(rolled(20, 6, 20), bag))).toEqual(["bone", "blood", "glass"]);
  });

  it("fills in with the theme's dice once they've run out", () => {
    expect(ids(stylesForThrow(rolled(20, 20, 20, 8), bag))).toEqual([
      "bone",
      "glass",
      undefined,
      undefined,
    ]);
  });

  it("skips dice that aren't thrown, as the tray does", () => {
    expect(ids(stylesForThrow(rolled(100, 20), bag))).toEqual(["bone"]);
  });
});
