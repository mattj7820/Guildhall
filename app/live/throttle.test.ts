import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Throttle } from "./throttle";

let sent: number[];
let throttle: Throttle;
beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  throttle = new Throttle(20, () => Date.now());
});
afterEach(() => vi.useRealTimers());

const push = (value: number) => throttle.push(() => sent.push(value));

describe("Throttle", () => {
  it("sends the first at once", () => {
    push(1);
    expect(sent).toEqual([1]);
  });

  it("sends at most 20 a second, ending with the latest", () => {
    push(1);
    push(2);
    push(3);
    expect(sent).toEqual([1]);
    vi.advanceTimersByTime(49);
    expect(sent).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([1, 3]);
  });

  it("keeps sending about 20 a second, evenly, while pushed steadily", () => {
    for (let ms = 0; ms < 1000; ms += 10) {
      push(ms);
      vi.advanceTimersByTime(10);
    }
    expect(sent.length).toBeGreaterThanOrEqual(19);
    expect(sent.length).toBeLessThanOrEqual(21);
    const gaps = sent.slice(2).map((value, index) => value - sent[index + 1]);
    expect(new Set(gaps)).toEqual(new Set([50]));
  });

  it("sends nothing more once cancelled (the token was let go)", () => {
    push(1);
    push(2);
    throttle.cancel();
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([1]);
  });
});
