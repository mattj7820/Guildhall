import { data } from "react-router";
import { z } from "zod";
import { readJson } from "~/.server/read-json";
import { servicesContext, viewerContext } from "~/context";
import { stuntEventSchema } from "~/maps/stunts";
import type { Route } from "./+types/map-stunts";

const bodySchema = z.object({ stunt: stuntEventSchema });

/**
 * The DM plays a stunt or a sound on a map, as JSON: POST `{ stunt }`. Everyone watching hears it
 * at once, each as they may see it; nothing is kept. The DM's only: anyone else gets the same 404
 * as for a missing map.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const map = await services.maps.get(params.id);
  if (viewer.role !== "dm" || !map) throw data("Not found", { status: 404 });

  const body = await readJson(request, bodySchema);
  if (!body.success)
    return Response.json({ error: "That stunt couldn't be read." }, { status: 400 });
  const { stunt } = body.data;
  if (stunt.kind === "sound") {
    const path = `${services.config.soundsFolder}/${stunt.sound}`;
    if (!services.vault.current.soundsIn(services.config.soundsFolder).includes(path)) {
      return Response.json({ error: "That sound isn't in the sounds folder." }, { status: 400 });
    }
  }
  await services.live.stunt(map.id, stunt);
  return Response.json({ ok: true });
}
