import { spellText } from "~/.server/characters/spell-catalogue";
import { notFound } from "~/.server/not-found";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/spell-text";

/**
 * JSON: one spell's text (`?key=`, as `srdSpellKey` or `noteSpellKey` makes it), as this viewer
 * may read it. A vault note that's missing or kept from them is the same 404.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const text = spellText(context.get(servicesContext).vault.current, viewer, key);
  if (!text) notFound();
  return Response.json(text, { headers: { "Cache-Control": "private, no-cache" } });
}
