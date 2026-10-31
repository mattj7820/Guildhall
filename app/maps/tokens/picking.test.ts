import { describe, expect, it } from "vitest";
import type { TokenView } from "./types";
import { addToPick, tokensInBox, togglePick } from "./picking";

const token = (id: string, at: [number, number]): TokenView => ({
  id,
  kind: "marker",
  at,
  size: 1,
  name: id,
  movable: true,
});

describe("tokensInBox", () => {
  const tokens = [token("a", [0.2, 0.2]), token("b", [0.5, 0.5]), token("c", [0.8, 0.3])];

  it("picks the tokens whose centre is inside, whichever way the box was drawn", () => {
    expect(tokensInBox(tokens, [0.1, 0.1], [0.6, 0.6])).toEqual(["a", "b"]);
    expect(tokensInBox(tokens, [0.9, 0.1], [0.4, 0.6])).toEqual(["b", "c"]);
  });

  it("picks nothing with a box around no centres", () => {
    expect(tokensInBox(tokens, [0.3, 0.3], [0.4, 0.4])).toEqual([]);
  });
});

describe("togglePick", () => {
  it("adds a token that isn't picked, and takes out one that is", () => {
    expect(togglePick(["a"], "b")).toEqual(["a", "b"]);
    expect(togglePick(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("addToPick", () => {
  it("adds each token once, keeping the order they came in", () => {
    expect(addToPick(["b"], ["a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });
});
