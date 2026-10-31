/** Which tokens a viewer may see on a map, as they may see them. */
import type { EntityId, Viewer } from "~/campaign/types";
import { characterAccess, type Controllers } from "~/characters/permissions";
import { pointRevealed } from "../fog/mask";
import type { FogMask } from "../fog/types";
import { fightAllowsMove, type Fight } from "~/combat/fight";
import type { MonsterCombatant } from "~/combat/types";
import type { MarkerToken, Token, TokenView } from "./types";

/** The URL of an NPC's picture (by the token), if its note has one; looked up on the server. */
export type PictureOf = (token: MarkerToken) => string | undefined;

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
  /** The fight the table is in, which monsters' tokens stand for, and party members are in. */
  fight?: Fight;
  pictureOf?: PictureOf;
}

/**
 * The tokens on a map for one viewer. Players get:
 * - their own party members (their PC, and the companion they share) always, even under the fog:
 *   it tells them only where they already know they are;
 * - other party members only where it's revealed;
 * - markers only if the DM shows them, and only where it's revealed.
 * Markers set aside are off the map, for everyone: the DM finds them in their own list.
 * Anything else is left out entirely, so it can't be found in the page's data. The DM gets every
 * token, with what players can't see of it. Tokens under the fog are "under" by their centre.
 */
export function tokensForViewer({
  tokens,
  viewer,
  fog,
  party,
  fight,
  pictureOf = () => undefined,
}: Input): TokenView[] {
  const views: TokenView[] = [];
  for (const token of tokens) {
    if (token.kind === "marker" && token.aside) continue;
    const revealed = pointRevealed(fog, token.at);
    if (token.kind === "combatant") {
      const monster = fight?.encounter.combatants.find((c) => c.id === token.combatant);
      const secret = monster?.kind !== "monster" || !!monster.hidden;
      // Players see a monster in the fight, unless it's hidden, where it's revealed.
      if (viewer.role !== "dm" && (secret || !revealed)) continue;
      views.push({
        id: token.id,
        kind: "combatant",
        at: token.at,
        size: token.size ?? 1,
        name: monster?.name ?? "Not in the fight",
        movable: viewer.role === "dm",
        combatant: token.combatant,
        ...(monster?.kind === "monster" && monster.hp.current <= 0
          ? { colour: "grey" as const, down: true }
          : { colour: "red" as const }),
        ...(viewer.role === "dm" && {
          ...(monster?.kind === "monster" && {
            hp: { current: monster.hp.current, max: monster.hp.max },
          }),
          ...(secret ? { hidden: "secret" as const } : !revealed && { hidden: "fog" as const }),
        }),
      });
      continue;
    }
    if (token.kind === "marker") {
      const monster = inTheFight(token, fight);
      const secret = monster ? !!monster.hidden : token.visibility !== "players";
      if (viewer.role !== "dm" && (secret || !revealed)) continue;
      views.push(markerView(token, viewer, revealed, pictureOf, monster));
      continue;
    }

    const member = party(token.note);
    if (!member) continue;
    const access = characterAccess(viewer, member.controllers);
    if (access === "none") continue;
    const theirs = access === "edit";
    if (viewer.role !== "dm" && !theirs && !revealed) continue;
    const inFight = fight?.encounter.combatants.find(
      (c) => c.kind === "player" && c.entityId === token.note,
    );
    views.push({
      id: token.id,
      kind: "character",
      at: token.at,
      size: token.size ?? 1,
      name: member.name,
      ...(member.portraitUrl && { portraitUrl: member.portraitUrl }),
      movable: theirs && fightAllowsMove(fight, token.map, token.note, viewer),
      ...(inFight && { combatant: inFight.id }),
      ...(viewer.role === "dm"
        ? { note: token.note, ...(!revealed && { hidden: "fog" as const }) }
        : !revealed && { inTheDark: true }),
    });
  }
  return views;
}

/** The monster a marker is in the fight, while it's in it. */
function inTheFight(token: MarkerToken, fight: Fight | undefined): MonsterCombatant | undefined {
  if (!token.combatant) return undefined;
  const combatant = fight?.encounter.combatants.find((c) => c.id === token.combatant);
  return combatant?.kind === "monster" ? combatant : undefined;
}

/**
 * A marker as a viewer who may see it sees it: its own name, and the picture the DM chose for it
 * (the one the DM sees on it), so showing a token shows exactly what's on it. Its note, and the
 * settings behind the picture, are the DM's only. A monster's marker is down at 0 hit points,
 * for everyone; while it's in the fight, the fight says whether it's hidden, and its hit points.
 */
export function markerView(
  token: MarkerToken,
  viewer: Viewer,
  revealed: boolean,
  pictureOf: PictureOf,
  monster?: MonsterCombatant,
): TokenView {
  const portraitUrl = token.picture === "note" ? pictureOf(token) : undefined;
  const icon = token.picture === "icon" ? token.icon : undefined;
  const secret = monster ? !!monster.hidden : token.visibility !== "players";
  const hp = monster ? { current: monster.hp.current, max: monster.hp.max } : token.hp;
  return {
    id: token.id,
    kind: "marker",
    at: token.at,
    size: token.size ?? 1,
    name: token.name,
    colour: token.colour,
    ...(portraitUrl ? { portraitUrl } : icon && { icon }),
    movable: viewer.role === "dm",
    ...(monster && { combatant: monster.id }),
    ...(hp && hp.current <= 0 && { down: true }),
    ...(viewer.role === "dm" && {
      // In the fight, the fight's hiding is the one switch.
      visibility: secret ? ("dm" as const) : ("players" as const),
      marker: {
        ...(token.note && { note: token.note }),
        ...(token.picture && { picture: token.picture }),
        ...(token.icon && { icon: token.icon }),
        ...(token.statblock && { statblock: token.statblock }),
      },
      ...(hp && { hp }),
      ...(secret ? { hidden: "secret" as const } : !revealed && { hidden: "fog" as const }),
    }),
  };
}
