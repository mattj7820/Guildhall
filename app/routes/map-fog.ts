import { data } from "react-router";
import { z } from "zod";
import { servicesContext, viewerContext } from "~/context";
import { encodeCells } from "~/maps/fog/mask";
import { fogChangesSchema } from "~/maps/fog/schema";
import type { FogView } from "~/maps/fog/types";
import type { Route } from "./+types/map-fog";

const bodySchema = z.object({ changes: fogChangesSchema });

/**
 * The DM's fog tools save here, as JSON. POST `{ changes }`: applies them in order to the fog as
 * stored now and answers with the result, so the page can catch up with changes made elsewhere.
 * DM only (not while previewing as a player); like every post, it must come from Guildhall's own
 * pages.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const { maps, fogs } = context.get(servicesContext);
  const map = await maps.get(params.id);
  if (!map) throw data("Not found", { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw data("Send JSON.", { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "These fog changes couldn't be read." }, { status: 400 });
  }

  const { mask, version } = await fogs.apply(map.id, map.image, body.data.changes);
  const fog: FogView = {
    cols: mask.cols,
    rows: mask.rows,
    cells: encodeCells(mask.cells),
    version,
  };
  return Response.json({ fog });
}
