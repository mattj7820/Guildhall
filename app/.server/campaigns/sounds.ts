import type { Services } from "~/context";

/**
 * The sound board's folder, as a vault path: `SOUNDS_FOLDER` inside the running campaign's
 * folder, so each campaign has its own sounds. A setting that already names a path in the
 * campaign's folder is taken as it is.
 */
export function soundsFolderOf({ config, vault }: Pick<Services, "config" | "vault">): string {
  const sounds = config.soundsFolder.replace(/^\/+|\/+$/g, "");
  const campaign = vault.folder;
  if (!campaign || sounds === campaign || sounds.startsWith(`${campaign}/`)) return sounds;
  return `${campaign}/${sounds}`;
}
