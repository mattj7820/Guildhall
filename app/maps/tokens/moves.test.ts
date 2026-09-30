import { describe, expect, it } from "vitest";
import { movesReducer, shownTokens, startMoves, type Moves, type MovesEvent } from "./moves";
import type { TokenView } from "./types";

const token = (id: string, at: [number, number]): TokenView => ({
  id,
  kind: "character",
  at,
  size: 1,
  name: id,
  movable: true,
});

const play = (tokens: TokenView[], ...events: MovesEvent[]): Moves =>
  events.reduce(movesReducer, startMoves(tokens));
const positions = (state: Moves) =>
  Object.fromEntries(shownTokens(state).map((each) => [each.id, each.at]));

const one = token("one", [0.1, 0.1]);
const two = token("two", [0.9, 0.9]);

describe("movesReducer and shownTokens", () => {
  it("shows the server's tokens until anything happens", () => {
    expect(shownTokens(startMoves([one, two]))).toEqual([one, two]);
  });

  it("shows a dragged token under the pointer", () => {
    const state = play([one], { type: "dragged", id: "one", at: [0.4, 0.4] });
    expect(positions(state)).toEqual({ one: [0.4, 0.4] });
  });

  it("keeps a dragged token under the pointer whatever the server says meanwhile", () => {
    const state = play(
      [one, two],
      { type: "dragged", id: "one", at: [0.4, 0.4] },
      { type: "pushed", tokens: [token("one", [0.7, 0.7]), token("two", [0.5, 0.5])] },
    );
    // Others' moves still show; only the one in hand holds still.
    expect(positions(state)).toEqual({ one: [0.4, 0.4], two: [0.5, 0.5] });
  });

  it("keeps a dropped token where it was put until the server answers, never jumping back", () => {
    const dropped = play(
      [one],
      { type: "dragged", id: "one", at: [0.4, 0.4] },
      { type: "dropped", id: "one", at: [0.5, 0.5] },
      { type: "sent" },
      // An older push arriving while the move is on its way is left alone.
      { type: "pushed", tokens: [one] },
    );
    expect(positions(dropped)).toEqual({ one: [0.5, 0.5] });

    const answered = movesReducer(dropped, {
      type: "answered",
      tokens: [token("one", [0.5, 0.5])],
    });
    expect(answered.pending).toEqual({});
    expect(positions(answered)).toEqual({ one: [0.5, 0.5] });
  });

  it("puts a token back where the server has it when a move is refused", () => {
    const state = play(
      [one],
      { type: "dropped", id: "one", at: [0.5, 0.5] },
      { type: "sent" },
      { type: "answered", tokens: [one] },
    );
    expect(positions(state)).toEqual({ one: [0.1, 0.1] });
  });

  it("keeps a move showing until every request on its way has been answered", () => {
    const state = play(
      [one, two],
      { type: "dropped", id: "one", at: [0.5, 0.5] },
      { type: "sent" },
      { type: "dropped", id: "two", at: [0.6, 0.6] },
      { type: "sent" },
      { type: "answered", tokens: [token("one", [0.5, 0.5]), two] },
    );
    expect(positions(state)).toEqual({ one: [0.5, 0.5], two: [0.6, 0.6] });
  });

  it("takes pushes again once nothing is on its way", () => {
    const state = play(
      [one],
      { type: "sent" },
      { type: "answered" },
      { type: "pushed", tokens: [token("one", [0.3, 0.3])] },
    );
    expect(positions(state)).toEqual({ one: [0.3, 0.3] });
  });

  it("drops a move of a token that has gone meanwhile", () => {
    const state = play(
      [one],
      { type: "dragged", id: "one", at: [0.4, 0.4] },
      { type: "pushed", tokens: [two] },
    );
    expect(shownTokens(state)).toEqual([two]);
  });

  it("puts a token back where it was when a drag is cancelled", () => {
    const state = play(
      [one],
      { type: "dragged", id: "one", at: [0.4, 0.4] },
      { type: "cancelled" },
    );
    expect(positions(state)).toEqual({ one: [0.1, 0.1] });
  });

  describe("others' drags", () => {
    const moving = (at: [number, number], now = 0): MovesEvent => ({
      type: "othersMoving",
      id: "one",
      at,
      by: "Player One",
      now,
    });

    it("shows a token where someone else is dragging it, and who", () => {
      const [shown] = shownTokens(play([one], moving([0.3, 0.3])));
      expect(shown).toMatchObject({ at: [0.3, 0.3], movingBy: "Player One" });
    });

    it("keeps showing their drag while other tokens change", () => {
      const state = play([one, two], moving([0.3, 0.3]), {
        type: "pushed",
        tokens: [token("one", [0.1, 0.1]), token("two", [0.5, 0.5])],
      });
      expect(positions(state)).toEqual({ one: [0.3, 0.3], two: [0.5, 0.5] });
    });

    it("lets their drag land where the server says they put it", () => {
      const state = play([one], moving([0.3, 0.3]), {
        type: "pushed",
        tokens: [token("one", [0.31, 0.3])],
      });
      expect(shownTokens(state)[0]).not.toHaveProperty("movingBy");
      expect(positions(state)).toEqual({ one: [0.31, 0.3] });
    });

    it("forgets a drag nothing more has been heard of, as when a tab closed mid-drag", () => {
      const state = play([one], moving([0.3, 0.3], 1000), { type: "tick", now: 3999 });
      expect(positions(state)).toEqual({ one: [0.3, 0.3] });
      expect(positions(movesReducer(state, { type: "tick", now: 4000 }))).toEqual({
        one: [0.1, 0.1],
      });
    });

    it("never moves a token in hand here, whatever others' drags say", () => {
      const state = play([one], { type: "dragged", id: "one", at: [0.4, 0.4] }, moving([0.3, 0.3]));
      expect(shownTokens(state)[0]).toMatchObject({ at: [0.4, 0.4], inHand: true });
    });
  });
});
