import { beforeEach, describe, expect, it } from "vitest";
import { HOLD_MS, Holds, type Holder } from "./holds";

let now: number;
let holds: Holds;
beforeEach(() => {
  now = 1000;
  holds = new Holds(() => now);
});

const holder = (name: string, extra: Partial<Holder> = {}): Holder => ({
  connection: {},
  discordId: name,
  name,
  isDm: false,
  ...extra,
});

const one = holder("Player One");
const two = holder("Player Two");
const dm = holder("The DM", { isDm: true });

describe("Holds", () => {
  it("gives a free token to whoever picks it up first, and keeps others out", () => {
    expect(holds.grab("m", "dog", one)).toEqual({ granted: true });
    expect(holds.grab("m", "dog", two)).toEqual({ granted: false, by: "Player One" });
    expect(holds.grab("m", "dog", one)).toEqual({ granted: true });
  });

  it("holds each token on each map on its own", () => {
    holds.grab("m", "dog", one);
    expect(holds.grab("m", "pc", two).granted).toBe(true);
    expect(holds.grab("other", "dog", two).granted).toBe(true);
  });

  it("frees a token when it's put down, but only by whoever has it", () => {
    holds.grab("m", "dog", one);
    holds.release("m", "dog", two.connection);
    expect(holds.grab("m", "dog", two).granted).toBe(false);
    holds.release("m", "dog", one.connection);
    expect(holds.grab("m", "dog", two).granted).toBe(true);
  });

  it("frees a token a few seconds after its holder last moved it", () => {
    holds.grab("m", "dog", one);
    now += HOLD_MS - 1;
    expect(holds.grab("m", "dog", two).granted).toBe(false);
    holds.grab("m", "dog", one); // still moving: held a while longer
    now += HOLD_MS - 1;
    expect(holds.grab("m", "dog", two).granted).toBe(false);
    now += 1;
    expect(holds.grab("m", "dog", two).granted).toBe(true);
  });

  it("frees everything a closed tab held", () => {
    holds.grab("m", "dog", one);
    holds.grab("m", "pc", one);
    holds.releaseAll(one.connection);
    expect(holds.grab("m", "dog", two).granted).toBe(true);
    expect(holds.grab("m", "pc", two).granted).toBe(true);
  });

  it("lets the DM take a token from anyone, and then keeps players out", () => {
    holds.grab("m", "dog", one);
    expect(holds.grab("m", "dog", dm)).toEqual({ granted: true });
    expect(holds.grab("m", "dog", one)).toEqual({ granted: false, by: "The DM" });
  });

  it("says who else holds a token when a move is saved, never keeping out its holder or the DM", () => {
    holds.grab("m", "dog", one);
    expect(holds.heldByOther("m", "dog", "Player Two", false)).toBe("Player One");
    // The same member in another tab.
    expect(holds.heldByOther("m", "dog", "Player One", false)).toBeUndefined();
    expect(holds.heldByOther("m", "dog", "The DM", true)).toBeUndefined();
    expect(holds.heldByOther("m", "pc", "Player Two", false)).toBeUndefined();
  });
});
