import { data } from "react-router";
import { streamVaultFile } from "~/.server/vault/stream-file";
import { servicesContext } from "~/context";
import type { Route } from "./+types/sound";

/**
 * One sound from the DM's sound board: audio in the vault's sounds folder, by its path inside it.
 * Anyone signed in may have these (the DM plays them for the table); nothing else in the vault
 * can be reached this way.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { config, vault } = context.get(servicesContext);
  const vaultPath = `${config.soundsFolder}/${params["*"] ?? ""}`;
  if (!vault.current.soundsIn(config.soundsFolder).includes(vaultPath)) {
    throw data("Not found", { status: 404 });
  }
  return streamVaultFile(request, config.vaultPath, vaultPath);
}
