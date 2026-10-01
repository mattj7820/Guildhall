import { data } from "react-router";
import { z } from "zod";
import { openableCharacter } from "~/.server/characters/openable";
import { actionBatchSchema } from "~/characters/actions";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character-changes";

/**
 * The sheet's save endpoint, as JSON. GET: the character as stored now (an open sheet polls it to
 * see others' changes). POST `{ baseRevision, actions }`: applies the actions to what's stored
 * now and answers with the result. Only for those who may open the character; like every post,
 * it must come from Guildhall's own pages.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const character = await openableCharacter(services, params.id, context.get(viewerContext));
  return Response.json({ character });
}

const bodySchema = z.object({
  baseRevision: z.number().int().min(0),
  actions: actionBatchSchema,
});

export async function action({ request, params, context }: Route.ActionArgs) {
  const services = context.get(servicesContext);
  await openableCharacter(services, params.id, context.get(viewerContext));

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw data("Send JSON.", { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  // A portrait must be an image the sender could load anyway, or it would be a way to see others.
  const viewer = context.get(viewerContext);
  const hidden = body.data?.actions.some(
    (action) =>
      action.type === "portrait" &&
      action.value !== undefined &&
      !services.vault.current.getAsset(action.value, viewer),
  );
  if (hidden) return Response.json({ error: "Choose an image from the vault." }, { status: 400 });
  if (!body.success) {
    return Response.json({ error: "These changes couldn't be read." }, { status: 400 });
  }

  const applied = await services.characters.apply(
    params.id,
    body.data.actions,
    body.data.baseRevision,
  );
  if (!applied) throw data("Not found", { status: 404 });
  if ("problem" in applied) return Response.json({ error: applied.problem }, { status: 409 });
  // Hit points show in the fight, so those watching it hear of the change.
  await services.live.fightChanged();
  return Response.json(applied);
}
