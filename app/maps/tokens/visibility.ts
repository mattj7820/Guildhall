/** Which tokens a viewer may see on a map, as they may see them. */
import type { EntityId, Viewer } from "~/campaign/types";
import { characterAccess, type Controllers } from "~/characters/permissions";
import { pointRevealed } from "../fog/mask";
import type { FogMask } from "../fog/types";
import type { Token, TokenView } from "./types";

/** A party member as this viewer may know them: missing if they may not know of them at all. */
export interface PartyMember {
  name: string;
  portraitUrl?: string;
  controllers: Controllers;
}

interface Input {
  /** The tokens on one map. */
  tokens: readonly Token[];
  viewer: Viewer;
  fog: FogMask;
  party: (note: EntityId) => PartyMember | undefined;
}

/**
 * The tokens on a map for one viewer. Players get:
 * - their own party members (their PC, and the companion they share) always, even under the fog:
 *   it tells them only where they already know they are;
 * - other party members only where it's revealed;
 * - markers only if the DM shows them, and only where it's revealed.
 * Anything else is left out entirely, so it can't be found in the page's data. The DM gets every
 * token, with what players can't see of it. Tokens under the fog are "under" by their centre.
 */
export function tokensForViewer({ tokens, viewer, fog, party }: Input): TokenView[] {
  const views: TokenView[] = [];
  for (const token of tokens) {
    const revealed = pointRevealed(fog, token.at);
    if (token.kind === "marker") {
      const secret = token.visibility !== "players";
      if (viewer.role !== "dm" && (secret || !revealed)) continue;
      views.push({
        id: token.id,
        kind: "marker",
        at: token.at,
        name: token.name,
        colour: token.colour,
        movable: viewer.role === "dm",
        ...(viewer.role === "dm" && {
          visibility: token.visibility,
          ...(secret ? { hidden: "secret" as const } : !revealed && { hidden: "fog" as const }),
        }),
      });
      continue;
    }

    const member = party(token.note);
    if (!member) continue;
    const access = characterAccess(viewer, member.controllers);
    if (access === "none") continue;
    const theirs = access === "edit";
    if (viewer.role !== "dm" && !theirs && !revealed) continue;
    views.push({
      id: token.id,
      kind: "character",
      at: token.at,
      name: member.name,
      ...(member.portraitUrl && { portraitUrl: member.portraitUrl }),
      movable: theirs,
      ...(viewer.role === "dm"
        ? !revealed && { hidden: "fog" as const }
        : !revealed && { inTheDark: true }),
    });
  }
  return views;
}
