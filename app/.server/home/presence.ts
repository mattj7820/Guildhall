import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { Presence } from "~/live/messages";
import { partyCards } from "../characters/load";
import type { Online } from "../live/hub";
import { partyControllers } from "../maps/tokens";

/**
 * Who's here now, as one viewer knows the party: the PCs whose player has Guildhall open, by the
 * names on their party cards. A companion is the whole party's, so it's never anyone's presence.
 */
export async function presenceFor(
  services: Pick<Services, "vault" | "characters">,
  viewer: Viewer,
  online: Online,
): Promise<Presence> {
  const vault = services.vault.current;
  const controllers = partyControllers(vault);
  const { cards } = partyCards(vault, await services.characters.list(), viewer);
  return {
    dm: online.dm,
    party: cards
      .filter((card) => {
        const who = controllers(card.note);
        return (
          card.kind === "pc" &&
          typeof who === "object" &&
          who.players.some((player) => online.players.has(player))
        );
      })
      .map((card) => card.name),
  };
}
