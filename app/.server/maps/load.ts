import { stat } from "node:fs/promises";
import path from "node:path";
import type { EntityId, Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { CampaignMap, MapView, NoteLink } from "~/maps/types";
import { noteUrl } from "~/wiki/urls";
import type { Vault } from "../vault/vault";
import { mapView } from "./view";

/**
 * The absolute path of a file the vault index knows about, or undefined. The containment check
 * is a second line of defence: only paths found when the vault was read reach here.
 */
export function vaultFile(vaultRoot: string, vaultPath: string): string | undefined {
  const absolute = path.resolve(vaultRoot, vaultPath);
  return absolute.startsWith(vaultRoot + path.sep) ? absolute : undefined;
}

/** Changes whenever the file does, so the image URL changes when a map is re-exported. */
async function imageVersion(vaultRoot: string, vaultPath: string): Promise<string | undefined> {
  const absolute = vaultFile(vaultRoot, vaultPath);
  if (!absolute) return undefined;
  try {
    const { mtimeMs, size } = await stat(absolute);
    return `${Math.floor(mtimeMs).toString(36)}-${size.toString(36)}`;
  } catch {
    return undefined; // Deleted since the vault was last read.
  }
}

/** A note the viewer may see, rendered for them. */
export function noteLink(vault: Vault, id: EntityId, viewer: Viewer): NoteLink | undefined {
  const note = vault.noteById(id, viewer);
  return (
    note && {
      id: note.id,
      title: note.title,
      url: noteUrl(note.slug),
      html: vault.render(note, viewer),
      hasOwnTitle: note.hasOwnTitle,
    }
  );
}

/** The map prepared for the viewer, with its image found in the current vault. */
export async function loadMapView(
  { config, vault }: Pick<Services, "config" | "vault">,
  map: CampaignMap,
  maps: readonly CampaignMap[],
  viewer: Viewer,
): Promise<MapView | undefined> {
  const current = vault.current;
  const found = current.findImage(map.image.path);
  const version = found && (await imageVersion(config.vaultPath, found.path));
  return mapView({
    map,
    maps,
    viewer,
    image: found && version ? { ...found, version } : undefined,
    note: (id) => noteLink(current, id, viewer),
  });
}
