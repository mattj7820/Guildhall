import { describe, expect, it } from "vitest";
import { applyDamage, applyHealing, fullHp, gainTempHp, setMaxHp } from "./hp";

const hp = (current: number, max = 10, temp = 0) => ({ current, max, temp });

describe("applyDamage", () => {
  it("reduces current HP", () => {
    expect(applyDamage(hp(10), 4)).toEqual(hp(6));
  });

  it("stops at 0", () => {
    expect(applyDamage(hp(3), 20)).toEqual(hp(0));
  });

  it("uses up temporary HP first", () => {
    expect(applyDamage(hp(10, 10, 5), 3)).toEqual(hp(10, 10, 2));
    expect(applyDamage(hp(10, 10, 5), 8)).toEqual(hp(7, 10, 0));
  });

  it.each([
    ["negative", -5],
    ["not a number", Number.NaN],
  ])("ignores a %s amount", (_label, amount) => {
    expect(applyDamage(hp(10), amount)).toEqual(hp(10));
  });

  it("drops fractions", () => {
    expect(applyDamage(hp(10), 2.9)).toEqual(hp(8));
  });
});

describe("applyHealing", () => {
  it("raises current HP up to the maximum", () => {
    expect(applyHealing(hp(4), 3)).toEqual(hp(7));
    expect(applyHealing(hp(8), 5)).toEqual(hp(10));
  });

  it("brings a downed monster back up", () => {
    expect(applyHealing(hp(0), 2)).toEqual(hp(2));
  });

  it("doesn't touch temporary HP", () => {
    expect(applyHealing(hp(4, 10, 3), 2)).toEqual(hp(6, 10, 3));
  });
});

describe("gainTempHp", () => {
  it("keeps the higher amount rather than stacking", () => {
    expect(gainTempHp(hp(10, 10, 5), 3)).toEqual(hp(10, 10, 5));
    expect(gainTempHp(hp(10, 10, 5), 8)).toEqual(hp(10, 10, 8));
  });
});

describe("setMaxHp", () => {
  it("raises current HP along with the maximum", () => {
    expect(setMaxHp(hp(10), 14)).toEqual(hp(14, 14));
    expect(setMaxHp(hp(4), 14)).toEqual(hp(8, 14));
  });

  it("caps current HP when the maximum drops", () => {
    expect(setMaxHp(hp(10), 6)).toEqual(hp(6, 6));
    expect(setMaxHp(hp(3), 6)).toEqual(hp(3, 6));
  });

  it("never goes below 1", () => {
    expect(setMaxHp(hp(5), 0)).toEqual(hp(1, 1));
  });
});

describe("fullHp", () => {
  it("starts at the maximum with no temporary HP", () => {
    expect(fullHp(7)).toEqual(hp(7, 7));
  });
});
