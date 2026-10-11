import { spellOptions } from "~/.server/characters/spell-catalogue";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/spells";

/**
 * JSON: every spell this viewer may pick for a sheet (the SRD's, and the vault spell notes they
 * may read), without their text. Loaded when the spell picker opens, rather than with every sheet.
 */
export function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const spells = spellOptions(context.get(servicesContext).vault.current, viewer);
  // Vault notes change, so the browser asks again each time a picker opens.
  return Response.json({ spells }, { headers: { "Cache-Control": "private, no-cache" } });
}
