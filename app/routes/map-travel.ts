import { DataFileError } from "~/.server/data/json-store";
import { loadTokens, partyControllers } from "~/.server/maps/tokens";
import { fightStopsTravel, loadTravelWays, travelLanding } from "~/.server/maps/travel";
import { notFound } from "~/.server/not-found";
import { readJson } from "~/.server/read-json";
import { canView } from "~/campaign/visibility";
import { accountContext, servicesContext, viewerContext } from "~/context";
import { canMoveToken } from "~/maps/tokens/permissions";
import { travelSchema } from "~/maps/tokens/schema";
import type { Route } from "./+types/map-travel";

/**
 * A party member taken from this map to another, as JSON. POST `{ token, to }`: into a deeper map
 * through an area the viewer sees here, or up to the map above. The server works out the ways and
 * where the token lands; a way the viewer doesn't have is the same 404 as a map that doesn't exist,
 * so nothing about hidden maps gets out. Answers with the map it went to.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  if (!map || !canView(viewer, map.visibility)) notFound();

  const body = await readJson(request, travelSchema);
  if (!body.success) {
    return Response.json({ error: "That move couldn't be read." }, { status: 400 });
  }
  const way = (await loadTravelWays(services, map, maps, viewer)).find(
    (each) => each.map.id === body.data.to,
  );
  const target = way && maps.find((each) => each.id === way.map.id);
  if (!way || !target) notFound();

  const controllersOf = partyControllers(services.vault.current);
  const token = (await services.tokens.list()).find((each) => each.id === body.data.token);
  // Someone else's token, or none, or not here: refused the same way.
  if (
    !token ||
    token.kind !== "character" ||
    token.map !== map.id ||
    !canMoveToken(viewer, token, controllersOf(token.note))
  ) {
    return Response.json({ error: "You can't move that." }, { status: 403 });
  }
  const stopped = fightStopsTravel(await services.fight.get(), map.id, target.id, token.note);
  if (stopped) return Response.json({ error: stopped }, { status: 409 });
  const account = context.get(accountContext);
  const discordId = account.kind === "member" ? account.member.discordId : "";
  const holder = services.live.heldByOther(map.id, token.id, discordId, viewer.role === "dm");
  if (holder) return Response.json({ error: `${holder} is moving that.` }, { status: 409 });

  // Beside the party members there that this viewer would see.
  const there = await loadTokens(services, target, viewer);
  const beside = there
    .filter((each) => each.kind === "character" && each.id !== token.id && !each.inTheDark)
    .map((each) => each.at);
  const to = travelLanding(way, target, beside);

  let changed: string[];
  try {
    ({ changed } = await services.tokens.apply(
      map.id,
      [{ type: "move", id: token.id, to, map: target.id }],
      // Still here when the change is made.
      (_action, tokens) => tokens.some((each) => each.id === token.id && each.map === map.id),
    ));
  } catch (error) {
    if (error instanceof DataFileError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
  await Promise.all(changed.map((each) => services.live.mapChanged(each)));
  if (changed.length === 0) {
    return Response.json({ error: "You can't move that." }, { status: 403 });
  }
  return Response.json({ map: target.id });
}
