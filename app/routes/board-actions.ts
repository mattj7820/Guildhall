import { z } from "zod";
import { boardActor, boardView, cardsSeenBy } from "~/.server/board/board-page";
import { DataFileError } from "~/.server/data/json-store";
import { notFound } from "~/.server/not-found";
import { readJson } from "~/.server/read-json";
import { boardActionsSchema } from "~/board/schema";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/board-actions";

const bodySchema = z.object({ actions: boardActionsSchema });

/**
 * Changes to the notice board, as JSON. POST `{ actions }`: applies each the viewer may make to
 * the board as stored now, and answers with the board as they may see it. Everyone with the board
 * open hears at once. A card they can't see is refused the same as a missing one.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const actor = boardActor(viewer);
  // Someone with nothing to put up has nothing to post.
  if (!actor) notFound();

  const body = await readJson(request, bodySchema);
  if (!body.success) {
    return Response.json({ error: "These board changes couldn't be read." }, { status: 400 });
  }

  let refused: number;
  try {
    ({ refused } = await services.board.apply(
      body.data.actions,
      actor,
      cardsSeenBy(services.vault.current, viewer),
    ));
  } catch (error) {
    if (error instanceof DataFileError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
  await services.live.boardChanged();

  const board = await boardView(services, viewer);
  if (refused > 0) {
    return Response.json({ error: "That isn't yours to change.", board }, { status: 403 });
  }
  return Response.json({ board });
}
