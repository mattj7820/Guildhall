import { describe, expect, it } from "vitest";
import { applyTokenAction, mapsTouched } from "./actions";
import { aCharacterToken, aMarker } from "./test-builders";

const pc = aCharacterToken({ id: "pc", map: "world", at: [0.1, 0.1] });
const marker = aMarker({ id: "inn", map: "world", at: [0.5, 0.5] });

describe("applyTokenAction", () => {
  it("places a new token", () => {
    const placed = aMarker({ id: "new" });
    expect(applyTokenAction([pc], { type: "place", token: placed })).toEqual({
      tokens: [pc, placed],
      changed: true,
    });
  });

  it("moves a party member placed again, since each is in one place, keeping its ID", () => {
    const again = aCharacterToken({ id: "other-id", map: "town", at: [0.3, 0.3] });
    const { tokens } = applyTokenAction([pc, marker], { type: "place", token: again });
    expect(tokens).toEqual([{ ...pc, map: "town", at: [0.3, 0.3] }, marker]);
  });

  it("treats a retried place as a move to the same spot, never a second token", () => {
    const once = applyTokenAction([], { type: "place", token: marker }).tokens;
    expect(applyTokenAction(once, { type: "place", token: marker })).toEqual({
      tokens: [marker],
      changed: false,
    });
  });

  it("moves a token about its map, whatever the sender last saw", () => {
    const { tokens, changed } = applyTokenAction([pc], {
      type: "move",
      id: "pc",
      to: [0.9, 0.2],
      from: [0.4, 0.4],
    });
    expect(tokens).toEqual([{ ...pc, at: [0.9, 0.2] }]);
    expect(changed).toBe(true);
  });

  it("moves a token to another map", () => {
    const { tokens } = applyTokenAction([pc], {
      type: "move",
      id: "pc",
      to: [0.2, 0.2],
      map: "keep",
    });
    expect(tokens).toEqual([{ ...pc, map: "keep", at: [0.2, 0.2] }]);
  });

  it("changes nothing for a token that has gone, such as one removed meanwhile", () => {
    expect(applyTokenAction([pc], { type: "move", id: "gone", to: [0.2, 0.2] })).toEqual({
      tokens: [pc],
      changed: false,
    });
    expect(applyTokenAction([pc], { type: "remove", id: "gone" }).changed).toBe(false);
  });

  it("removes a token", () => {
    expect(applyTokenAction([pc, marker], { type: "remove", id: "pc" })).toEqual({
      tokens: [marker],
      changed: true,
    });
  });

  it("edits only what's given of a marker", () => {
    const { tokens } = applyTokenAction([marker], {
      type: "editMarker",
      id: "inn",
      colour: "blue",
      visibility: "players",
    });
    expect(tokens).toEqual([{ ...marker, colour: "blue", visibility: "players" }]);
  });

  it("sizes a token in squares, storing nothing for the usual one square", () => {
    const large = applyTokenAction([pc], { type: "setSize", id: "pc", size: 2 });
    expect(large.tokens).toEqual([{ ...pc, size: 2 }]);
    const back = applyTokenAction(large.tokens, { type: "setSize", id: "pc", size: 1 });
    expect(back.tokens).toEqual([pc]);
    expect(back.changed).toBe(true);
  });

  it("leaves a party member alone when asked to edit it as a marker", () => {
    expect(applyTokenAction([pc], { type: "editMarker", id: "pc", name: "Renamed" })).toEqual({
      tokens: [pc],
      changed: false,
    });
  });

  it("doesn't change the list it's given", () => {
    const tokens = [pc];
    applyTokenAction(tokens, { type: "remove", id: "pc" });
    expect(tokens).toEqual([pc]);
  });
});

describe("mapsTouched", () => {
  it("is the token's map for a move about it", () => {
    expect(mapsTouched([pc], { type: "move", id: "pc", to: [0, 0] })).toEqual(["world"]);
  });

  it("is both maps when a token moves between them, or a party member is placed elsewhere", () => {
    expect(mapsTouched([pc], { type: "move", id: "pc", to: [0, 0], map: "keep" })).toEqual([
      "world",
      "keep",
    ]);
    const again = aCharacterToken({ id: "x", map: "town" });
    expect(mapsTouched([pc], { type: "place", token: again })).toEqual(["world", "town"]);
  });

  it("is nothing for a token that has gone", () => {
    expect(mapsTouched([pc], { type: "remove", id: "gone" })).toEqual([]);
  });
});
