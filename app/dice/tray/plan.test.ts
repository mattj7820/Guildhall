import { describe, expect, it } from "vitest";
import { seededRng } from "../rng";
import type { DieRoll } from "../roll";
import { MOST_DICE_THROWN, planThrow, quaternionAt } from "./plan";
import { dieShape, faceUp } from "./shapes";
import { TRAY_SIDES, throwsAny } from "./thrown";

const TRAY = { halfX: 9, halfZ: 6 };
const die = (sides: number, value: number, kept = true): DieRoll => ({ sides, value, kept });

/** What each die shows on top in a plan's last frame. */
function shownOnTop(plan: ReturnType<typeof planThrow>): number[] {
  const last = plan.frames[plan.frames.length - 1];
  return plan.dice.map((planned, index) => {
    const shape = dieShape(planned.sides);
    return planned.labels[faceUp(shape, quaternionAt(last, index))];
  });
}

describe("dieShape", () => {
  it.each([4, 6, 8, 10, 12, 20])("has one number for each face of a d%i", (sides) => {
    expect(dieShape(sides).faces).toHaveLength(sides);
  });
});

describe("planThrow", () => {
  it.each([...TRAY_SIDES])("lands every face of a d%i on top when it's the roll", (sides) => {
    for (let value = 1; value <= sides; value++) {
      const plan = planThrow([die(sides, value)], seededRng(sides * 100 + value), TRAY);
      expect(shownOnTop(plan)).toEqual([value]);
    }
  });

  it("lands a handful of mixed dice, thrown together, on their rolls", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const pick = seededRng(seed + 1000);
      const rolls = [4, 6, 8, 10, 12, 20, 20].map((sides) => die(sides, pick(sides)));
      const plan = planThrow(rolls, seededRng(seed), TRAY);
      expect(shownOnTop(plan)).toEqual(rolls.map((roll) => roll.value));
    }
  });

  it("numbers each die 1 to n, each number once", () => {
    const plan = planThrow([die(12, 7), die(10, 10)], seededRng(3), TRAY);
    for (const planned of plan.dice) {
      expect([...planned.labels].sort((a, b) => a - b)).toEqual(
        Array.from({ length: planned.sides }, (_, i) => i + 1),
      );
    }
  });

  it("throws the same way from the same seed", () => {
    const rolls = [die(20, 14), die(6, 2)];
    const one = planThrow(rolls, seededRng(9), TRAY);
    const two = planThrow(rolls, seededRng(9), TRAY);
    expect(two.frames).toEqual(one.frames);
    expect(two.dice).toEqual(one.dice);
  });

  it("keeps a dropped die, to draw it faded", () => {
    const plan = planThrow([die(20, 5, false), die(20, 17)], seededRng(4), TRAY);
    expect(plan.dice.map((planned) => planned.kept)).toEqual([false, true]);
  });

  it("leaves dice it can't draw to the text, and throws at most ten", () => {
    const rolls = [die(100, 42), die(3, 2), ...Array.from({ length: 12 }, () => die(6, 3))];
    const plan = planThrow(rolls, seededRng(5), TRAY);
    expect(plan.dice).toHaveLength(MOST_DICE_THROWN);
    expect(plan.dice.every((planned) => planned.sides === 6)).toBe(true);
  });

  it("ends within three and a half seconds, with a sound for each knock in the throw", () => {
    const plan = planThrow([die(20, 1), die(8, 8), die(4, 4)], seededRng(6), TRAY);
    expect(plan.frames.length).toBeLessThanOrEqual(210);
    expect(plan.rolling).toHaveLength(plan.frames.length);
    expect(plan.knocks.length).toBeGreaterThan(0);
    for (const knock of plan.knocks) {
      expect(knock.frame).toBeLessThan(plan.frames.length);
      expect(knock.strength).toBeGreaterThan(0);
      expect(knock.strength).toBeLessThanOrEqual(1);
    }
  });
});

describe("throwsAny", () => {
  it("is false for dice only shown as text", () => {
    expect(throwsAny([die(100, 50), die(2, 1)])).toBe(false);
    expect(throwsAny([die(100, 50), die(6, 1)])).toBe(true);
  });
});
