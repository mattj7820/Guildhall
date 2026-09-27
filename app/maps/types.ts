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
