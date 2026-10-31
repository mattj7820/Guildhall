import { describe, expect, it } from "vitest";
import { countdown } from "./countdown";

// Local times, as the browser shows them.
const now = new Date(2026, 9, 31, 14, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

describe("countdown", () => {
  it("counts calendar days, so tomorrow evening is tomorrow", () => {
    expect(countdown(new Date(2026, 10, 1, 9, 0), now, "en")).toBe("tomorrow");
    expect(countdown(new Date(2026, 10, 3, 19, 0), now, "en")).toBe("in 3 days");
  });

  it("counts hours and minutes on the day", () => {
    expect(countdown(at(31, 19), now, "en")).toBe("in 5 hours");
    expect(countdown(at(31, 14, 20), now, "en")).toBe("in 20 minutes");
  });

  it("is on for a few hours after it starts, then the last one", () => {
    expect(countdown(at(31, 12), now, "en")).toBe("on now");
    expect(countdown(at(31, 9), now, "en")).toBe("the last one");
  });
});
