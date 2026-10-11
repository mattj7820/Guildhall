// PROTOTYPE (removed before the PR): preparing spells on the sheet and beside the map.
import { requireDm } from "~/.server/not-found";
import { viewerContext } from "~/context";
import { PreparePrototype } from "~/prototype/prepare-spells/PreparePrototype";
import type { Route } from "./+types/prepare-spells-prototype";

export function meta() {
  return [{ title: "Preparing spells prototype · Guildhall" }];
}

export function loader({ context }: Route.LoaderArgs) {
  requireDm(context.get(viewerContext));
  return null;
}

export default function PrepareSpellsPrototypePage() {
  return <PreparePrototype />;
}
