import { data } from "react-router";
import { controllersOf } from "~/.server/characters/controllers";
import { portraitPath } from "~/.server/characters/load";
import { noteLookup } from "~/.server/characters/openable";
import { serveVaultImage } from "~/.server/vault/serve-image";
import { characterAccess } from "~/characters/permissions";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character-portrait";

/**
 * A character's portrait, by character ID. Anyone who sees the character, even only its summary,
 * sees its portrait; which image that is follows `portraitPath`, so it's never one from a note
 * or DM part kept from the viewer.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const { characters, config, vault } = context.get(servicesContext);
  const character = await characters.get(params.id);
  const findNote = noteLookup({ vault });
  if (!character || characterAccess(viewer, controllersOf(character, findNote)) === "none") {
    throw data("Not found", { status: 404 });
  }
  const image = portraitPath(vault.current, character, viewer);
  const response = image && (await serveVaultImage(request, config.vaultPath, image));
  if (!response) throw data("Not found", { status: 404 });
  return response;
}
