import { data } from "react-router";
import { controllersOf } from "~/.server/characters/controllers";
import { characterPage } from "~/.server/characters/load";
import type { Services } from "~/context";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { canEdit } from "~/characters/permissions";
import { CharacterSheet } from "~/components/characters/CharacterSheet";
import { CompanionSheet } from "~/components/characters/CompanionSheet";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.name ?? "Character"} · Guildhall` }];
}

/**
 * The character if this viewer may open it. Anyone else gets the same 404 as for a character that
 * doesn't exist, so a player can't tell another's sheet is there.
 */
async function openable(services: Services, id: string, viewer: Viewer) {
  const character = await services.characters.get(id);
  const findNote = (note: string) => services.vault.current.noteById(note, DM_VIEWER);
  if (!character || !canEdit(viewer, controllersOf(character, findNote))) {
    throw data("Not found", { status: 404 });
  }
  return character;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const character = await openable(services, params.id, viewer);
  return characterPage(services.vault.current, character, viewer);
}

export default function Character({ loaderData }: Route.ComponentProps) {
  return loaderData.character.kind === "pc" ? (
    <CharacterSheet page={loaderData} />
  ) : (
    <CompanionSheet page={loaderData} />
  );
}
