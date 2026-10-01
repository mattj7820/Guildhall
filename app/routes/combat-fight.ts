import { data } from "react-router";
import { z } from "zod";
import { fightForViewer } from "~/combat/fight";
import { encounterSchema } from "~/combat/schema";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat-fight";

/**
 * JSON: the fight the table is in. GET answers with it as the viewer may see it (or `null`).
 * POST:
 * - `{ intent: "save", encounter, after, map? }` (the DM): saves the tracker's encounter, if the
 *   stored fight is still the revision it last had; otherwise 409 with the newer fight;
 * - `{ intent: "end" }` (the DM): the fight is over;
 * - `{ intent: "endTurn" }` (a player): ends their own turn, if it is theirs.
 * Everyone watching hears the change at once, each as they may see it.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const fight = await context.get(servicesContext).fight.get();
  return Response.json(
    { fight: fight ? fightForViewer(fight, viewer) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const bodySchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("save"),
    encounter: encounterSchema,
    after: z.number().int().nonnegative(),
    map: z.string().min(1).max(100).optional(),
  }),
  z.object({ intent: z.literal("end") }),
  z.object({ intent: z.literal("endTurn") }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw data("Send JSON.", { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return Response.json({ error: "That couldn't be read." }, { status: 400 });

  if (body.data.intent === "endTurn") {
    const fight = await services.fight.endTurn(viewer);
    if (!fight) return Response.json({ error: "It isn't your turn." }, { status: 409 });
    await services.live.fightChanged();
    return Response.json({ fight: fightForViewer(fight, viewer) });
  }

  // Everything else is the DM's.
  if (viewer.role !== "dm") throw data("Not found", { status: 404 });
  if (body.data.intent === "end") {
    await services.fight.end();
    await services.live.fightChanged();
    return Response.json({ fight: null });
  }
  const { encounter, after, map } = body.data;
  const saved = await services.fight.save(encounter, after, map);
  if ("stale" in saved) {
    return Response.json(
      {
        error: "The fight changed meanwhile.",
        fight: saved.stale ? fightForViewer(saved.stale, viewer) : null,
      },
      { status: 409 },
    );
  }
  await services.live.fightChanged();
  return Response.json({ fight: fightForViewer(saved.fight, viewer) });
}
