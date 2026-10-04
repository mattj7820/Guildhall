// PROTOTYPE (removed before the PR): spells, slots, uses, hit dice and rests on the full sheet.
import { useSearchParams } from "react-router";
import { requireDm } from "~/.server/not-found";
import { viewerContext } from "~/context";
import { SheetPrototype } from "~/prototype/sheet-tracking/SheetPrototype";
import type { Route } from "./+types/sheet-tracking-prototype";

export function meta() {
  return [{ title: "Sheet tracking prototype · Guildhall" }];
}

export function loader({ context }: Route.LoaderArgs) {
  requireDm(context.get(viewerContext));
  return null;
}

export default function SheetTrackingPrototypePage() {
  const [params] = useSearchParams();
  const map = params.get("map");
  return <SheetPrototype mapLink={map ? `/maps/${map}/sheet-prototype` : undefined} />;
}
