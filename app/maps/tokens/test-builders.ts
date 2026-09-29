/** Tokens for tests, stating only the fields each test depends on. */
import type { CharacterToken, MarkerToken } from "./types";

export function aCharacterToken(fields: Partial<CharacterToken> = {}): CharacterToken {
  return {
    kind: "character",
    id: "pc-one-token",
    map: "world",
    at: [0.5, 0.5],
    note: "Party/Fixture PC One",
    ...fields,
  };
}

export function aMarker(fields: Partial<MarkerToken> = {}): MarkerToken {
  return {
    kind: "marker",
    id: "marker",
    map: "world",
    at: [0.5, 0.5],
    name: "Fixture marker",
    colour: "red",
    visibility: "dm",
    ...fields,
  };
}
