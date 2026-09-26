import { describe, expect, it } from "vitest";
import { monster, player } from "./test-builders";
import { firstTurn, isBloodied, isDown, nextTurn, previousTurn } from "./turns";

const down = (name: string) => monster(name, { hp: { current: 0, max: 10, temp: 0 } });

describe("nextTurn", () => {
  const order = [monster("A"), player("B"), monster("C")];

  it("moves to the next combatant", () => {
    expect(nextTurn(order, { round: 1, activeId: "A" })).toEqual({ round: 1, activeId: "B" });
  });

  it("starts a new round after the last combatant", () => {
    expect(nextTurn(order, { round: 1, activeId: "C" })).toEqual({ round: 2, activeId: "A" });
  });

  it("skips monsters that are down", () => {
    const withDown = [monster("A"), down("B"), monster("C")];
    expect(nextTurn(withDown, { round: 1, activeId: "A" })).toEqual({ round: 1, activeId: "C" });
  });

  it("counts the new round when skipping past the end", () => {
    const withDown = [down("A"), monster("B"), monster("C")];
    expect(nextTurn(withDown, { round: 1, activeId: "C" })).toEqual({ round: 2, activeId: "B" });
  });

  it("never skips player-controlled combatants", () => {
    // Players track their own HP and death saves, so the tracker always gives them their turn.
    const withPlayer = [monster("A"), player("B")];
    expect(nextTurn(withPlayer, { round: 1, activeId: "A" }).activeId).toBe("B");
  });

  it("still steps along when nobody can act", () => {
    expect(nextTurn([down("A"), down("B")], { round: 1, activeId: "A" })).toEqual({
      round: 1,
      activeId: "B",
    });
  });

  it("starts from the top if the active combatant is gone", () => {
    expect(nextTurn(order, { round: 3, activeId: "missing" })).toEqual({
      round: 3,
      activeId: "A",
    });
  });
});

describe("previousTurn", () => {
  const order = [monster("A"), down("B"), monster("C")];

  it("steps back, skipping monsters that are down", () => {
    expect(previousTurn(order, { round: 2, activeId: "C" })).toEqual({ round: 2, activeId: "A" });
  });

  it("goes back into the previous round", () => {
    expect(previousTurn(order, { round: 2, activeId: "A" })).toEqual({ round: 1, activeId: "C" });
  });

  it("doesn't go back before the first turn of round 1", () => {
    const position = { round: 1, activeId: "A" };
    expect(previousTurn(order, position)).toEqual(position);
  });
});

describe("firstTurn", () => {
  it("starts round 1 with the first combatant who can act", () => {
    expect(firstTurn([down("A"), monster("B")])).toEqual({ round: 1, activeId: "B" });
  });

  it("has no one active in an empty encounter", () => {
    expect(firstTurn([])).toEqual({ round: 1, activeId: null });
  });
});

describe("down and bloodied", () => {
  const at = (current: number) => monster("M", { hp: { current, max: 10, temp: 0 } });

  it.each([
    [10, false, false],
    [6, false, false],
    [5, true, false],
    [1, true, false],
    [0, false, true],
  ])("a monster at %i/10 HP: bloodied %s, down %s", (current, bloodied, isDownNow) => {
    expect(isBloodied(at(current))).toBe(bloodied);
    expect(isDown(at(current))).toBe(isDownNow);
  });

  it("never marks player-controlled combatants", () => {
    expect(isDown(player("P"))).toBe(false);
    expect(isBloodied(player("P"))).toBe(false);
  });
});
