import { z } from "zod";
import { DataFileError } from "~/.server/data/json-store";
import { diceStyle } from "~/.server/dice/catalogue";
import { everyDie } from "~/.server/dice/collections";
import { notFound } from "~/.server/not-found";
import { readJson } from "~/.server/read-json";
import { accountContext, servicesContext } from "~/context";
import type { OpenedDie } from "~/dice/collection";
import type { Route } from "./+types/dice-open";

const openSchema = z.object({ pack: z.string().min(1).max(100) });

/**
 * Opens one of the member's own packs, as JSON. POST `{ pack }`. The die is drawn here, on the
 * server, and answered with its style (now theirs to see). A pack that isn't theirs, or is
 * already open, is a 404.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const body = await readJson(request, openSchema);
  if (!body.success)
    return Response.json({ error: "That pack couldn't be read." }, { status: 400 });
  const { member } = account;
  // The sets the DM gave before packs are full kits already: never drawn again.
  const kits = everyDie().filter((die) => member.dice?.given?.includes(die.style));
  let result;
  try {
    result = await context
      .get(servicesContext)
      .dice.openPack(member.discordId, body.data.pack, kits);
  } catch (error) {
    if (!(error instanceof DataFileError)) throw error;
    return Response.json({ error: "Your dice couldn't be read just now." }, { status: 503 });
  }
  if (!result) notFound();
  if ("full" in result) {
    return Response.json(
      { error: "You have every die worth having. Keep this pack for when new dice arrive." },
      { status: 409 },
    );
  }
  const { style, sides, count, isNew, reason } = result.opened;
  const found = diceStyle(style);
  if (!found) notFound();
  const opened: OpenedDie = { style: found, sides, count, isNew, ...(reason && { reason }) };
  return Response.json({ opened });
}
