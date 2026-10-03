import { notFound } from "~/.server/not-found";
import { streamVaultFile } from "~/.server/vault/stream-file";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/vault-asset";

/**
 * Streams an attachment (image, audio, PDF…) from the vault, if this viewer may load it. Read-only,
 * and only files the vault index already knows about can be served.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { config, vault } = context.get(servicesContext);
  const vaultPath = vault.current.getAsset(params["*"] ?? "", context.get(viewerContext));
  if (!vaultPath) notFound();
  return streamVaultFile(request, config.vaultPath, vaultPath);
}
