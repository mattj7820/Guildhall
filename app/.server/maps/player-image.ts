/**
 * The only way players get a map's pixels: tiles cut from the image, with everything the fog
 * hides taken out on the server. The whole image (`map-image`) is for the DM alone.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  fogField,
  FULL_TILE,
  pixelAlpha,
  tileCount,
  tileRect,
  tileState,
  TILE_SIZE,
} from "~/maps/fog/tiles";
import type { FogField } from "~/maps/fog/tiles";
import type { FogMask } from "~/maps/fog/types";
import type { Size } from "~/maps/types";
import type { FileCache } from "../data/file-cache";

// libvips's own cache would keep decoded images around; the file cache does that job.
sharp.cache(false);

/** Enough to keep lettering on a map crisp, at a fraction of a PNG's size. */
const QUALITY = 82;
/** Masked tiles kept in memory: a session's worth of edges on a few maps. */
const MASKED_KEPT = 400;

/** A map image as found in the vault now. */
export interface SourceImage {
  /** Vault path, e.g. "Maps/World.png". */
  path: string;
  /** Where it is on disk. */
  absolute: string;
  /** Changes whenever the file does. */
  version: string;
}

export class PlayerImages {
  private readonly sizes = new Map<string, Promise<Size>>();
  private readonly masked = new Map<string, Promise<Buffer>>();
  private readonly fogs = new Map<string, { version: number; fog: FogField }>();

  constructor(
    private readonly cache: FileCache,
    readonly tileSize = TILE_SIZE,
  ) {}

  /** The fog ready for masking, worked out once per map and version rather than per tile. */
  playerFog(mapId: string, { mask, version }: { mask: FogMask; version: number }): FogField {
    const kept = this.fogs.get(mapId);
    if (kept?.version === version && kept.fog.mask.cells.length === mask.cells.length) {
      return kept.fog;
    }
    const fog = fogField(mask);
    this.fogs.set(mapId, { version, fog });
    return fog;
  }

  /** The image's real size in pixels, which tiles are cut from. */
  size(source: SourceImage): Promise<Size> {
    const id = `${source.absolute}|${source.version}`;
    let size = this.sizes.get(id);
    if (!size) {
      size = sharp(source.absolute)
        .metadata()
        .then(({ width, height }) => ({ width, height }));
      size.catch(() => this.sizes.delete(id));
      this.sizes.set(id, size);
    }
    return size;
  }

  /**
   * One tile as players may see it, or undefined if the fog hides all of it. Always follows the
   * fog as it is now, whatever an older URL asked for.
   */
  async tile(
    source: SourceImage,
    fog: FogField,
    x: number,
    y: number,
  ): Promise<{ data: Buffer; key: string } | undefined> {
    const size = await this.size(source);
    const { columns, rows } = tileCount(size, this.tileSize);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return undefined;
    if (x >= columns || y >= rows) return undefined;
    const state = tileState(fog, size, x, y, this.tileSize);
    if (!state) return undefined;
    await this.cut(source);
    const read = (name: string) => this.cache.read(keyOf(source), source.version, name);
    if (state.key === FULL_TILE) {
      const data = await read(`${x}-${y}.webp`);
      return data && { data, key: state.key };
    }

    const rect = tileRect(size, x, y, this.tileSize);
    const data = await this.remember(
      `${keyOf(source)}/${source.version}/${x}-${y}/${state.key}`,
      async () => {
        // Masked from an exact copy: a lossy one would already have blended hidden pixels in.
        const exact = await read(`${x}-${y}.png`);
        if (!exact) throw new Error(`Tile ${x}-${y} of ${source.path} is missing from the cache`);
        return mask(exact, pixelAlpha(fog, size, rect));
      },
    );
    return { data, key: state.key };
  }

  /** Cuts the image's tiles now, so no player waits for it. */
  async prepare(source: SourceImage): Promise<void> {
    await this.cut(source);
  }

  /**
   * Decodes the image once and cuts every tile from it twice: compressed, to send when players
   * may see all of it, and exact, to mask the ones they may see only part of.
   */
  private cut(source: SourceImage): Promise<string> {
    return this.cache.ensure(keyOf(source), source.version, async () => {
      const { data, info } = await sharp(source.absolute, { limitInputPixels: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const size = { width: info.width, height: info.height };
      const raw = { raw: { width: info.width, height: info.height, channels: 4 as const } };
      const files = new Map<string, Uint8Array>();
      const columns = Math.ceil(size.width / this.tileSize);
      const rows = Math.ceil(size.height / this.tileSize);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const [left, top, width, height] = tileRect(size, x, y, this.tileSize);
          const tile = () => sharp(data, raw).extract({ left, top, width, height });
          files.set(`${x}-${y}.webp`, await tile().webp({ quality: QUALITY }).toBuffer());
          files.set(`${x}-${y}.png`, await tile().png({ compressionLevel: 1 }).toBuffer());
        }
      }
      return files;
    });
  }

  /** Keeps recent masked images, forgetting the oldest. */
  private remember(id: string, make: () => Promise<Buffer>): Promise<Buffer> {
    const kept = this.masked.get(id);
    if (kept) {
      this.masked.delete(id);
      this.masked.set(id, kept);
      return kept;
    }
    const made = make();
    made.catch(() => this.masked.delete(id));
    this.masked.set(id, made);
    while (this.masked.size > MASKED_KEPT) this.masked.delete(this.masked.keys().next().value!);
    return made;
  }
}

/** A cache key for the image's vault path that says nothing about it. */
function keyOf(source: SourceImage): string {
  return createHash("sha256").update(source.path).digest("hex").slice(0, 24);
}

/**
 * Takes out what the fog hides. Where the fog's opacity is 0 (a hidden cell) the pixel becomes
 * transparent black, so nothing of it is left to recover; elsewhere the colour stays and the
 * opacity fades the edge in.
 */
async function mask(image: Buffer, opacity: Uint8Array): Promise<Buffer> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width * info.height !== opacity.length) {
    throw new Error("The fog doesn't match the image it's masking");
  }
  for (let i = 0; i < opacity.length; i++) {
    const shown = opacity[i];
    const pixel = i * 4;
    if (shown === 0) {
      data.fill(0, pixel, pixel + 4);
    } else if (shown < 255) {
      data[pixel + 3] = Math.round((data[pixel + 3] * shown) / 255);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: QUALITY, alphaQuality: 100 })
    .toBuffer();
}
