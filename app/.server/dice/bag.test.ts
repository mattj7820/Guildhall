import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stylesForThrow } from "~/dice/bag";
import type { OwnedDie } from "~/dice/collection";
import { aMember } from "../members/test-builders";
import { diceBag, rollingDice } from "./bag";
import { DICE_STYLES } from "./catalogue";
import { DiceCollections, everyDie } from "./collections";

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

describe("rollingDice", () => {
  /** A temporary data folder, with what's in `dice.json` (if anything). */
  async function withDice(run: (dice: DiceCollections, folder: string) => Promise<void>) {
    const folder = await mkdtemp(path.join(tmpdir(), "guildhall-rolling-"));
    try {
      await run(DiceCollections.inFolder(folder), folder);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  it("sends a member only their own dice's styles, with their packs to open", () =>
    withDice(async (dice) => {
      const member = aMember(1, { dice: { given: ["bone"] } });
      await dice.giveDie(member.discordId, "glass", 20);
      await dice.givePack(member.discordId);
      const { bag, packs } = await rollingDice(dice, member, false);
      expect(bag.styles.map((style) => style.id).sort()).toEqual(["bone", "glass"]);
      const sent = JSON.stringify(bag);
      for (const style of DICE_STYLES.filter(({ id }) => id !== "bone" && id !== "glass")) {
        expect(sent).not.toContain(style.label);
      }
      expect(packs).toBe(1);
    }));

  it("gives the DM a full roll's worth of every type, from all the dice, and no packs", () =>
    withDice(async (dice) => {
      const { bag, packs } = await rollingDice(dice, aMember(9), true);
      for (const sides of [4, 6, 8, 10, 12, 20] as const)
        expect(bag.byType[sides]).toHaveLength(10);
      // Only what's picked up is sent: the rarest, legendaries first.
      expect(bag.styles.every((style) => ["legendary", "veryRare"].includes(style.rarity))).toBe(
        true,
      );
      expect(packs).toBe(0);
    }));

  it("rolls the sets given before packs when dice.json can't be read, rather than failing", () =>
    withDice(async (dice, folder) => {
      await writeFile(path.join(folder, "dice.json"), "not JSON at all");
      const { bag, packs } = await rollingDice(
        dice,
        aMember(1, { dice: { given: ["bone"] } }),
        false,
      );
      expect(bag.styles.map((style) => style.id)).toEqual(["bone"]);
      expect(packs).toBe(0);
    }));
});
