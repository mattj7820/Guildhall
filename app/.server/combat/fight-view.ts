import type { Viewer } from "~/campaign/types";
import { fightForViewer, type Fight, type FightView } from "~/combat/fight";
import type { CombatantId, HitPoints } from "~/combat/types";
import { canSeeCombatantDetails } from "~/combat/visibility";
import type { Services } from "~/context";

/**
 * The fight as one viewer may see it, with the hit points of the party members in it from their
 * character sheets (players track their own there): every one for the DM, a player's own for them.
 */
export async function fightView(
  services: Pick<Services, "characters">,
  fight: Fight,
  viewer: Viewer,
): Promise<FightView> {
  const view = fightForViewer(fight, viewer);
  const characters = await services.characters.list();
  const hp: Record<CombatantId, HitPoints> = {};
  for (const combatant of fight.encounter.combatants) {
    if (combatant.kind !== "player" || !combatant.entityId) continue;
    if (!canSeeCombatantDetails(viewer, combatant)) continue;
    const character = characters.find((each) => each.note === combatant.entityId);
    if (character) hp[combatant.id] = character.kind === "pc" ? character.sheet.hp : character.hp;
  }
  return Object.keys(hp).length > 0 ? { ...view, hp } : view;
}
