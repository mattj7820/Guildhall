import { describe, expect, it } from "vitest";
import { aFeature, aSheet, withSlots } from "./test-builders";
import { count, counterOf, hitDieHealing, limit, longRest, shortRest } from "./tracking";

describe("count", () => {
  it("uses more, and gives back with a negative count", () => {
    expect(count({ max: 3, used: 1 }, 1)).toEqual({ max: 3, used: 2 });
    expect(count({ max: 3, used: 1 }, -1)).toEqual({ max: 3, used: 0 });
  });

  it("never goes below none or past the maximum", () => {
    expect(count({ max: 3, used: 3 }, 1)).toEqual({ max: 3, used: 3 });
    expect(count({ max: 3, used: 0 }, -2)).toEqual({ max: 3, used: 0 });
  });
});

describe("limit", () => {
  it("brings what's used down with a lower maximum", () => {
    expect(limit({ max: 4, used: 3 }, 2)).toEqual({ max: 2, used: 2 });
    expect(limit({ max: 2, used: 1 }, 4)).toEqual({ max: 4, used: 1 });
  });
});

describe("counterOf", () => {
  it("finds slots by level, hit dice by size and a feature's uses", () => {
    const sheet = aSheet({
      spellSlots: withSlots({ 2: { max: 3, used: 1 } }),
      hitDice: { ...aSheet().hitDice, d10: { max: 4, used: 2 } },
      features: [aFeature({ id: "ki", uses: { max: 2, used: 0, reset: "short" } })],
    });
    expect(counterOf(sheet, { slot: 2 })).toEqual({ max: 3, used: 1 });
    expect(counterOf(sheet, { hitDie: "d10" })).toEqual({ max: 4, used: 2 });
    expect(counterOf(sheet, { feature: "ki" })).toMatchObject({ max: 2, used: 0 });
  });

  it("finds nothing for a feature that's gone or has no uses", () => {
    const sheet = aSheet({ features: [aFeature({ id: "plain" })] });
    expect(counterOf(sheet, { feature: "plain" })).toBeUndefined();
    expect(counterOf(sheet, { feature: "gone" })).toBeUndefined();
  });
});

describe("hitDieHealing", () => {
  it("is the roll plus the CON modifier, and at least 1", () => {
    expect(hitDieHealing(5, 2)).toBe(7);
    expect(hitDieHealing(1, -2)).toBe(1);
  });
});

describe("shortRest", () => {
  const resting = aSheet({
    abilities: { ...aSheet().abilities, con: 14 },
    hp: { current: 4, max: 20, temp: 0 },
    hitDice: { ...aSheet().hitDice, d8: { max: 3, used: 1 } },
    spellSlots: withSlots({ 1: { max: 2, used: 2 } }),
    features: [
      aFeature({ id: "short", uses: { max: 2, used: 2, reset: "short" } }),
      aFeature({ id: "long", uses: { max: 1, used: 1, reset: "long" } }),
      aFeature({ id: "hand", uses: { max: 7, used: 3, reset: "manual" } }),
    ],
    concentrating: "Fixture Ward",
  });

  it("spends each hit die rolled, healing its roll plus CON", () => {
    const rested = shortRest(resting, [
      { die: "d8", face: 5 },
      { die: "d8", face: 2 },
    ]);
    expect(rested.sheet.hitDice.d8).toEqual({ max: 3, used: 3 });
    expect(rested.sheet.hp.current).toBe(4 + (5 + 2) + (2 + 2));
    expect(rested.healed).toBe(11);
  });

  it("skips dice that aren't left, such as ones spent in another tab", () => {
    const rested = shortRest(resting, [
      { die: "d8", face: 8 },
      { die: "d8", face: 8 },
      { die: "d8", face: 8 },
      { die: "d10", face: 8 },
    ]);
    expect(rested.spent).toHaveLength(2);
    expect(rested.sheet.hitDice.d8.used).toBe(3);
  });

  it("heals no further than the maximum", () => {
    const rested = shortRest({ ...resting, hp: { current: 18, max: 20, temp: 0 } }, [
      { die: "d8", face: 8 },
    ]);
    expect(rested.sheet.hp.current).toBe(20);
    expect(rested.healed).toBe(2);
  });

  it("gives back only uses that reset on a short rest", () => {
    const { features } = shortRest(resting, []).sheet;
    expect(features.map((feature) => feature.uses?.used)).toEqual([0, 1, 3]);
  });

  it("leaves spell slots and concentration as they were", () => {
    const { sheet } = shortRest(resting, []);
    expect(sheet.spellSlots[0]).toEqual({ max: 2, used: 2 });
    expect(sheet.concentrating).toBe("Fixture Ward");
  });
});

describe("longRest", () => {
  const tired = aSheet({
    hp: { current: 3, max: 20, temp: 5 },
    hitDice: { ...aSheet().hitDice, d8: { max: 2, used: 2 }, d10: { max: 1, used: 1 } },
    spellSlots: withSlots({ 1: { max: 2, used: 2 }, 2: { max: 1, used: 1 } }),
    features: [
      aFeature({ id: "short", uses: { max: 2, used: 2, reset: "short" } }),
      aFeature({ id: "long", uses: { max: 1, used: 1, reset: "long" } }),
      aFeature({ id: "hand", uses: { max: 7, used: 3, reset: "manual" } }),
    ],
    concentrating: "Fixture Ward",
  });

  it("restores every hit point and ends temporary ones", () => {
    const rested = longRest(tired);
    expect(rested.sheet.hp).toEqual({ current: 20, max: 20, temp: 0 });
    expect(rested.healed).toBe(17);
  });

  it("gives back every hit die and every spell slot", () => {
    const { sheet } = longRest(tired);
    expect(sheet.hitDice.d8.used).toBe(0);
    expect(sheet.hitDice.d10.used).toBe(0);
    expect(sheet.spellSlots.map((slot) => slot.used)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("gives back short and long rest uses, but not uses kept by hand", () => {
    const { features } = longRest(tired).sheet;
    expect(features.map((feature) => feature.uses?.used)).toEqual([0, 0, 3]);
  });

  it("ends concentration", () => {
    expect(longRest(tired).sheet.concentrating).toBe("");
  });
});
