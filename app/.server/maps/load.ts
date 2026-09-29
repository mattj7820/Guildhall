import { stat } from "node:fs/promises";
import path from "node:path";
import { PLAYER_VIEWER, type EntityId, type Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { CampaignMap, MapView, NoteLink } from "~/maps/types";
import { noteUrl } from "~/wiki/urls";
import type { Vault } from "../vault/vault";
import type { SourceImage } from "./player-image";
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
      hasOwnTitle: vault.hasOwnTitle(note, viewer),
    }
  );
}

/** The map's image as it is in the vault now (perhaps moved), or undefined if it's missing. */
export async function mapSource(
  { config, vault }: Pick<Services, "config" | "vault">,
  map: CampaignMap,
): Promise<(SourceImage & { moved: boolean }) | undefined> {
  const found = vault.current.findImage(map.image.path);
  const absolute = found && vaultFile(config.vaultPath, found.path);
  const version = found && (await imageVersion(config.vaultPath, found.path));
  return found && absolute && version ? { ...found, absolute, version } : undefined;
}

/** The map prepared for the viewer, with its image found in the current vault. */
export async function loadMapView(
  services: Pick<Services, "config" | "vault" | "fogs" | "playerImages">,
  map: CampaignMap,
  maps: readonly CampaignMap[],
  viewer: Viewer,
): Promise<MapView | undefined> {
  const { vault, fogs, playerImages } = services;
  const current = vault.current;
  const source = await mapSource(services, map);
  const fog = await fogs.get(map.id, map.image);
  const forPlayers = viewer.role !== "dm" && source;
  return mapView({
    map,
    maps,
    viewer,
    image: source,
    note: (id) => noteLink(current, id, viewer),
    fog,
    imageInSharedNote: !!source && current.getAsset(source.path, PLAYER_VIEWER) !== undefined,
    tiles: forPlayers
      ? {
          image: await playerImages.size(source),
          size: playerImages.tileSize,
          field: playerImages.playerFog(map.id, fog),
        }
      : undefined,
  });
}

const vaultNumbers = new WeakMap<Vault, number>();
let vaultsSeen = 0;

/**
 * Changes whenever anything a viewer sees of the map might: the map (its areas, links or sharing),
 * its fog, its image file, or the vault's notes. A player's open map polls it and reloads its data
 * only when it changes.
 */
export async function mapVersion(
  services: Pick<Services, "config" | "vault" | "fogs">,
  map: CampaignMap,
): Promise<string> {
  const vault = services.vault.current;
  let vaultNumber = vaultNumbers.get(vault);
  if (vaultNumber === undefined) {
    vaultNumber = ++vaultsSeen;
    vaultNumbers.set(vault, vaultNumber);
  }
  const [source, fog] = await Promise.all([
    mapSource(services, map),
    services.fogs.get(map.id, map.image),
  ]);
  return [map.updatedAt, fog.version, source?.version ?? "missing", vaultNumber].join(".");
}
