import { characterPage } from "~/.server/characters/load";
import { openableCharacter } from "~/.server/characters/openable";
import { CharacterSheet } from "~/components/characters/CharacterSheet";
import { CompanionSheet } from "~/components/characters/CompanionSheet";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.name ?? "Character"} · Guildhall` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const character = await openableCharacter(services, params.id, viewer);
  return characterPage(services.vault.current, character, viewer, await services.characters.list());
}

export default function Character({ loaderData }: Route.ComponentProps) {
  // A fresh editor for each character, so one sheet's unsaved changes can't reach another.
  return loaderData.character.kind === "pc" ? (
    <CharacterSheet key={loaderData.character.id} page={loaderData} />
  ) : (
    <CompanionSheet key={loaderData.character.id} page={loaderData} />
  );
}
