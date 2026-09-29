/**
 * Every change to tokens is a `TokenAction`, applied by one pure function in the browser (at
 * once) and on the server (to what's stored now), as for character sheets (decision 30).
 */
import type { MapId, Point } from "../types";
import type { MarkerToken, Token, TokenId } from "./types";

export type TokenAction =
  /**
   * Puts a token on a map, with an ID its sender made. A party member already somewhere else is
   * moved here instead, since each is in one place.
   */
  | { type: "place"; token: Token }
  /**
   * Moves a token to a point, and to another map if `map` is given (the DM only). `from` is where
   * the sender saw it; the move wins either way, as the last one made.
   */
  | { type: "move"; id: TokenId; to: Point; from?: Point; map?: MapId }
  | { type: "remove"; id: TokenId }
  | {
      type: "editMarker";
      id: TokenId;
      name?: string;
      colour?: MarkerToken["colour"];
      visibility?: MarkerToken["visibility"];
    };

export interface Applied {
  tokens: Token[];
  /** False when it changed nothing, such as a move of a token that's since been removed. */
  changed: boolean;
}

export function applyTokenAction(tokens: readonly Token[], action: TokenAction): Applied {
  const unchanged = { tokens: [...tokens], changed: false };
  switch (action.type) {
    case "place": {
      const placed = action.token;
      const existing = tokens.find(
        (token) =>
          token.id === placed.id ||
          (placed.kind === "character" && token.kind === "character" && token.note === placed.note),
      );
      if (!existing) return { tokens: [...tokens, placed], changed: true };
      // Placing again (a retried request, or a party member brought here) moves what's there.
      return replace(tokens, existing.id, (token) => ({
        ...token,
        map: placed.map,
        at: placed.at,
      }));
    }
    case "move":
      return replace(tokens, action.id, (token) => ({
        ...token,
        at: action.to,
        ...(action.map && { map: action.map }),
      }));
    case "remove":
      return tokens.some((token) => token.id === action.id)
        ? { tokens: tokens.filter((token) => token.id !== action.id), changed: true }
        : unchanged;
    case "editMarker":
      return replace(tokens, action.id, (token) =>
        token.kind === "marker"
          ? {
              ...token,
              ...(action.name !== undefined && { name: action.name }),
              ...(action.colour && { colour: action.colour }),
              ...(action.visibility && { visibility: action.visibility }),
            }
          : token,
      );
  }
}

function replace(tokens: readonly Token[], id: TokenId, change: (token: Token) => Token): Applied {
  let changed = false;
  const next = tokens.map((token) => {
    if (token.id !== id) return token;
    const updated = change(token);
    changed = JSON.stringify(updated) !== JSON.stringify(token);
    return updated;
  });
  return { tokens: next, changed };
}

/** The map a token is on after the action, and before it; one map unless it moved between them. */
export function mapsTouched(tokens: readonly Token[], action: TokenAction): MapId[] {
  const id = action.type === "place" ? action.token.id : action.id;
  const before = tokens.find(
    (token) =>
      token.id === id ||
      (action.type === "place" &&
        action.token.kind === "character" &&
        token.kind === "character" &&
        token.note === action.token.note),
  );
  const after =
    action.type === "place" ? action.token.map : action.type === "move" ? action.map : undefined;
  return [...new Set([before?.map, after].filter((map): map is MapId => !!map))];
}
