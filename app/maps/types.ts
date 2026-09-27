/**
 * The interactive maps model. Isomorphic: the server stores and resolves maps, the browser draws
 * and edits them.
 */
import type { EntityId, Visibility } from "~/campaign/types";

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

/** What the editor saves: everything the DM can change about a map. */
export type MapChanges = Pick<CampaignMap, "name" | "note" | "image" | "areas">;

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
}

/**
 * The map's image as the browser sees it. `missing` means it's no longer in the vault; `moved`
 * means a single image with the same name was found elsewhere (DM only, with its new path).
 */
export interface MapImageView {
  url?: string;
  status: "ok" | "moved" | "missing";
  /** DM only: where the image is recorded, and where it was found instead. */
  path?: string;
  movedTo?: string;
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
  /** Largest first, so smaller areas inside larger ones are drawn on top and can be clicked. */
  areas: AreaView[];
}
