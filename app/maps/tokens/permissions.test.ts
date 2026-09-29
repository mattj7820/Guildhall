import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import type { Controllers } from "~/characters/permissions";
import type { TokenAction } from "./actions";
import { canMoveToken, mayApply } from "./permissions";
import { aCharacterToken, aMarker } from "./test-builders";

const playerOne: Viewer = { role: "player", playerId: "player one" };
const pcOne = aCharacterToken({ id: "one", note: "Party/One", map: "world" });
const pcTwo = aCharacterToken({ id: "two", note: "Party/Two", map: "world" });
const companion = aCharacterToken({ id: "dog", note: "Party/Dog", map: "world" });
const lost = aCharacterToken({ id: "lost", note: "Party/Gone", map: "world" });
const marker = aMarker({ id: "inn", map: "world", visibility: "players" });
const tokens = [pcOne, pcTwo, companion, lost, marker];

const controllers: Record<string, Controllers> = {
  "Party/One": { players: ["player one"] },
  "Party/Two": { players: ["player two"] },
  "Party/Dog": "party",
  "Party/Gone": "unknown",
};
const controllersOf = (note: string) => controllers[note];
const move = (id: string, extra: Partial<TokenAction> = {}): TokenAction =>
  ({ type: "move", id, to: [0.2, 0.2], ...extra }) as TokenAction;

describe("canMoveToken", () => {
  it("lets the DM move anything", () => {
    for (const token of tokens) {
      const who = token.kind === "character" ? controllersOf(token.note) : "unknown";
      expect(canMoveToken(DM_VIEWER, token, who)).toBe(true);
    }
  });

  it.each([
    ["their own PC", pcOne, true],
    ["the companion the party shares", companion, true],
    ["another player's PC", pcTwo, false],
    ["a party member whose note has gone", lost, false],
  ])("lets a player move %s: %s", (_name, token, expected) => {
    expect(canMoveToken(playerOne, token, controllersOf(token.note))).toBe(expected);
  });

  it("never lets a player move a marker, even one they can see", () => {
    expect(canMoveToken(playerOne, marker, "party")).toBe(false);
  });

  it("lets a player the DM hasn't assigned move only the shared companion", () => {
    expect(canMoveToken(PLAYER_VIEWER, pcOne, controllersOf(pcOne.note))).toBe(false);
    expect(canMoveToken(PLAYER_VIEWER, companion, "party")).toBe(true);
  });
});

describe("mayApply", () => {
  const may = (viewer: Viewer, action: TokenAction, map = "world") =>
    mayApply(viewer, map, action, tokens, controllersOf);

  it("lets the DM do anything", () => {
    expect(may(DM_VIEWER, { type: "remove", id: "inn" })).toBe(true);
    expect(may(DM_VIEWER, move("two", { map: "keep" }))).toBe(true);
  });

  it("lets a player move their own tokens about the map they're on", () => {
    expect(may(playerOne, move("one"))).toBe(true);
    expect(may(playerOne, move("dog"))).toBe(true);
  });

  it.each<[string, TokenAction]>([
    ["move another player's PC", move("two")],
    ["move a marker", move("inn")],
    ["move a token that doesn't exist", move("nothing")],
    ["take their own PC to another map", move("one", { map: "keep" })],
    ["place a token", { type: "place", token: aMarker({ id: "mine" }) }],
    ["remove their own token", { type: "remove", id: "one" }],
    ["edit a marker", { type: "editMarker", id: "inn", name: "Mine now" }],
  ])("doesn't let a player %s", (_name, action) => {
    expect(may(playerOne, action)).toBe(false);
  });

  it("doesn't let a player move their token through a map it isn't on", () => {
    expect(may(playerOne, move("one"), "town")).toBe(false);
  });
});
