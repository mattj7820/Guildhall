import { z } from "zod";
import { requireDm } from "~/.server/not-found";
import { fightView } from "~/.server/combat/fight-view";
import { readJson } from "~/.server/read-json";
import { encounterSchema } from "~/combat/schema";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat-fight";

/**
 * JSON: the fight the table is in. GET answers with it as the viewer may see it (or `null`).
 * POST:
 * - `{ intent: "save", encounter, after, map? }` (the DM): saves the tracker's encounter, if the
 *   stored fight is still the revision it last had; otherwise 409 with the newer fight;
 * - `{ intent: "setFreeMovement", on }` (the DM): players move any time, or on their turn;
 * - `{ intent: "end", monsters? }` (the DM): the fight is over, and its monsters' tokens are
 *   cleared, or left (`monsters: "leave"`) as markers;
 * - `{ intent: "endTurn" }` (a player): ends their own turn, if it is theirs.
 * Everyone watching hears the change at once, each as they may see it.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const fight = await services.fight.get();
  return Response.json(
    { fight: fight ? await fightView(services, fight, viewer) : null },
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
  z.object({ intent: z.literal("setFreeMovement"), on: z.boolean() }),
  /** The monsters' tokens are cleared, or left where they fell as markers. */
  z.object({ intent: z.literal("end"), monsters: z.enum(["clear", "leave"]).default("clear") }),
  z.object({ intent: z.literal("endTurn") }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const body = await readJson(request, bodySchema);
  if (!body.success) return Response.json({ error: "That couldn't be read." }, { status: 400 });

  if (body.data.intent === "endTurn") {
    const fight = await services.fight.endTurn(viewer);
    if (!fight) return Response.json({ error: "It isn't your turn." }, { status: 409 });
    await services.live.fightChanged();
    return Response.json({ fight: await fightView(services, fight, viewer) });
  }

  // Everything else is the DM's.
  requireDm(viewer);
  if (body.data.intent === "setFreeMovement") {
    const changed = await services.fight.setFreeMovement(body.data.on);
    if (!changed) return Response.json({ error: "There's no fight." }, { status: 404 });
    await services.live.fightChanged();
    return Response.json({ fight: await fightView(services, changed, viewer) });
  }
  if (body.data.intent === "end") {
    const ended = await services.fight.end();
    const maps = ended
      ? await services.tokens.removeCombatants(
          ended.encounter.combatants,
          body.data.monsters === "leave",
        )
      : [];
    await services.live.fightChanged();
    await Promise.all(maps.map((map) => services.live.mapChanged(map)));
    return Response.json({ fight: null });
  }
  const { encounter, after, map } = body.data;
  const saved = await services.fight.save(encounter, after, map);
  if ("stale" in saved) {
    return Response.json(
      {
        error: "The fight changed meanwhile.",
        fight: saved.stale ? await fightView(services, saved.stale, viewer) : null,
      },
      { status: 409 },
    );
  }
  // Monsters taken out of the fight (or a new fight replacing it) take their tokens with them.
  const now = new Set(saved.fight.encounter.combatants.map((c) => c.id));
  const gone = saved.previous?.encounter.combatants.filter((c) => !now.has(c.id)) ?? [];
  const maps = gone.length > 0 ? await services.tokens.removeCombatants(gone, false) : [];
  await services.live.fightChanged();
  await Promise.all(maps.map((changed) => services.live.mapChanged(changed)));
  return Response.json({ fight: await fightView(services, saved.fight, viewer) });
}
