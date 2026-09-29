import { data } from "react-router";
import { z } from "zod";
import { DataFileError } from "~/.server/data/json-store";
import { loadTokens, partyControllers } from "~/.server/maps/tokens";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import type { TokenAction } from "~/maps/tokens/actions";
import { mayApply } from "~/maps/tokens/permissions";
import { tokenActionsSchema } from "~/maps/tokens/schema";
import type { Token } from "~/maps/tokens/types";
import type { Route } from "./+types/map-tokens";

const bodySchema = z.object({ actions: tokenActionsSchema });

/**
 * Token changes, as JSON. POST `{ actions }`: applies each to the tokens as stored now, if the
 * viewer may make it on this map, and answers with the map's tokens as they may see them. Anyone
 * watching the maps it changed hears at once. A map the viewer can't see is the same 404 as a
 * missing one; a token they can't see, or can't move, is refused the same way whether it exists
 * or not.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  if (!map || !canView(viewer, map.visibility)) throw data("Not found", { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw data("Send JSON.", { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "These token changes couldn't be read." }, { status: 400 });
  }

  const controllersOf = partyControllers(services.vault.current);
  const mapIds = new Set(maps.map((each) => each.id));
  const allowed = (action: TokenAction, tokens: readonly Token[]): boolean => {
    if (!mayApply(viewer, map.id, action, tokens, controllersOf)) return false;
    if (action.type === "place") {
      // Placed on this map; a party member only if they're one.
      const { token } = action;
      return (
        token.map === map.id && (token.kind === "marker" || controllersOf(token.note) !== "unknown")
      );
    }
    // Everything else acts on a token on this map, and a move elsewhere needs a map to go to.
    const token = tokens.find((each) => each.id === action.id);
    if (token?.map !== map.id) return false;
    return action.type !== "move" || !action.map || mapIds.has(action.map);
  };

  let refused: number;
  let changed: string[];
  try {
    ({ refused, changed } = await services.tokens.apply(map.id, body.data.actions, allowed));
  } catch (error) {
    // The stored tokens are damaged, or this would break a rule of the file (too many tokens).
    if (error instanceof DataFileError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "That's more tokens than a map can hold." }, { status: 400 });
    }
    throw error;
  }
  await Promise.all(changed.map((each) => services.live.mapChanged(each)));

  const tokens = await loadTokens(services, map, viewer);
  if (refused > 0) {
    return Response.json({ error: "You can't move that.", tokens }, { status: 403 });
  }
  return Response.json({ tokens });
}
