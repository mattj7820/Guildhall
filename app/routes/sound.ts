import { soundsFolderOf } from "~/.server/campaigns/sounds";
import { notFound } from "~/.server/not-found";
import { streamVaultFile } from "~/.server/vault/stream-file";
import { servicesContext } from "~/context";
import type { Route } from "./+types/sound";

/**
 * One sound from the DM's sound board: audio in the vault's sounds folder, by its path inside it.
 * Anyone signed in may have these (the DM plays them for the table); nothing else in the vault
 * can be reached this way.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const { config, vault } = services;
  const folder = soundsFolderOf(services);
  const vaultPath = `${folder}/${params["*"] ?? ""}`;
  if (!vault.current.soundsIn(folder).includes(vaultPath)) {
    notFound();
  }
  return streamVaultFile(request, config.vaultPath, vaultPath);
}
