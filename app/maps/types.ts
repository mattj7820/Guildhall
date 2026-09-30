/**
 * The interactive maps model. Isomorphic: the server stores and resolves maps, the browser draws
 * and edits them.
 */
import type { EntityId, Visibility } from "~/campaign/types";
import type { FogView } from "./fog/types";
import type { MapGrid } from "./grid/grid";

export type MapId = string;
export type AreaId = string;

/**
 * A point as fractions of the image's width and height (0..1), so outlines survive the map being
 * re-exported at a different resolution.
 */
export type Point = [x: number, y: number];

export interface Size {
  width: number;
  height: number;
}

/** A vault image, and the pixel size its areas were drawn against. */
export interface MapImage extends Size {
  path: string;
}

/** Named `CampaignMap` because `Map` is a JavaScript built-in. */
export interface CampaignMap {
  id: MapId;
  name: string;
  image: MapImage;
  /** The wiki note this map illustrates, e.g. a region's note. */
  note?: EntityId;
  visibility: Visibility;
  areas: Area[];
  /** A battle grid over the image, making it a battle map. */
  grid?: MapGrid;
  /** False when tokens move freely on the grid; they snap to its squares unless it says so. */
  snapToGrid?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An outlined part of a map. It can lead to a more detailed map, a wiki note, both or neither. */
export interface Area {
  id: AreaId;
  name: string;
  outline: Point[];
  map?: MapId;
  note?: EntityId;
  visibility: Visibility;
}

/**
 * What the editor saves. The image is left out: it changes only through its own action (a moved
 * or resized image), so an editor's autosave can't put back an image replaced meanwhile.
 */
export type MapChanges = Pick<CampaignMap, "name" | "note" | "areas" | "grid">;

/** A link to a map, as shown in breadcrumbs, lists and area panels. */
export interface MapLink {
  id: MapId;
  name: string;
}

/** A wiki note linked from a map or area, rendered for the viewer. */
export interface NoteLink {
  id: EntityId;
  title: string;
  url: string;
  html: string;
  /** The body opens with its own `# Heading`, so the panel doesn't repeat the title. */
  hasOwnTitle: boolean;
}

/**
 * The map's image as the browser sees it. `missing` means it's no longer in the vault; `moved`
 * means a single image with the same name was found elsewhere (DM only, with its new path).
 */
export interface MapImageView {
  /** DM only: the whole image. Players only ever get the parts the fog reveals. */
  url?: string;
  /** Players only: the tiles of the image they may have. */
  tiles?: TileLayer;
  status: "ok" | "moved" | "missing";
  /** DM only: where the image is recorded, and where it was found instead. */
  path?: string;
  movedTo?: string;
  /**
   * DM only: the image is embedded in a note players can read, so the wiki shows them all of it,
   * whatever the fog hides here.
   */
  inSharedNote?: boolean;
}

/** The tiles of an image players may have, each drawn at its place on the map. */
export interface TileLayer {
  /** The image's real size in pixels, which tiles are cut from (maybe not the map's `size`). */
  width: number;
  height: number;
  /** A tile's side in image pixels; each also overlaps its neighbours by `overlap`. */
  size: number;
  overlap: number;
  tiles: { x: number; y: number; url: string }[];
}

/** An area as the viewer may see it: hidden targets are simply absent. */
export interface AreaView {
  id: AreaId;
  name: string;
  outline: Point[];
  map?: MapLink;
  note?: NoteLink;
  /** DM only: links that no longer lead anywhere. */
  broken: ("map" | "note")[];
  /** DM only: players never see this area. */
  secret?: boolean;
}

/** A map prepared for one viewer, safe to send to the browser. */
export interface MapView {
  id: MapId;
  name: string;
  /** The pixel size the areas were drawn against. */
  size: Size;
  image: MapImageView;
  note?: NoteLink;
  /** DM only: the map's note link no longer leads anywhere. */
  noteBroken: boolean;
  /** Ancestors, outermost first, then this map. */
  breadcrumbs: MapLink[];
  /**
   * Largest first, so smaller areas inside larger ones are drawn on top and can be clicked. For
   * players, only areas that aren't secret and are at least half revealed.
   */
  areas: AreaView[];
  /** What's revealed. For players it describes only what they can see anyway. */
  fog: FogView;
  /** Its battle grid, if it has one. */
  grid?: MapGrid;
  /** Whether tokens snap to the grid's squares (only with a grid). */
  snapToGrid?: boolean;
  /** DM only: whether players can see this map. */
  shared?: boolean;
}
