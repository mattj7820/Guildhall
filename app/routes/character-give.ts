import { z } from "zod";
import { notFound } from "~/.server/not-found";
import { controllersOf } from "~/.server/characters/controllers";
import { nameOf } from "~/.server/characters/load";
import { noteLookup, openableCharacter } from "~/.server/characters/openable";
import { readJson } from "~/.server/read-json";
import { QUANTITY_MAX } from "~/characters/inventory";
import { characterAccess } from "~/characters/permissions";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character-give";

const bodySchema = z.object({
  item: z.string().min(1).max(64),
  amount: z.number().int().min(1).max(QUANTITY_MAX),
  to: z.string().min(1).max(64),
});

/**
 * Gives some or all of a stack from this character's bag to another party member's, as JSON
 * `{ item, amount, to }`. Only from a bag the viewer may change, to a character they can see; the
 * answer is the giver's bag only, never the recipient's.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const services = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const from = await openableCharacter(services, params.id, viewer);

  const body = await readJson(request, bodySchema);
  if (!body.success) {
    return Response.json({ error: "That gift couldn't be read." }, { status: 400 });
  }

  const findNote = noteLookup(services);
  const to = await services.characters.get(body.data.to);
  if (!to || characterAccess(viewer, controllersOf(to, findNote)) === "none") {
    return Response.json({ error: "They're not in the party." }, { status: 404 });
  }

  const gift = await services.characters.give(from.id, {
    item: body.data.item,
    amount: body.data.amount,
    to: to.id,
    givenBy: nameOf(from, findNote(from.note)),
  });
  if (!gift) notFound();
  if ("problem" in gift) return Response.json({ error: gift.problem }, { status: 409 });
  return Response.json({ character: gift.from });
}
