/**
 * Character sheets and their inventories. Isomorphic: stored by the server, edited in the browser.
 */
import type { EntityId } from "~/campaign/types";

export type ItemId = string;

/** A built-in icon from `item-icons.ts`, by ID. Vault images may join later. */
export interface IconRef {
  builtin: string;
}

/** Where an item came from: free text ("Session 1"), a vault note (a place, a person), or both. */
export interface ItemSource {
  text?: string;
  note?: EntityId;
}

/**
 * Something a character carries. Its name and icon are copied when it's added, so the tile still
 * says what the player was told if the linked note is renamed, removed or kept secret.
 */
export interface InventoryItem {
  id: ItemId;
  name: string;
  icon: IconRef;
  /** A whole number, at least 1. */
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  /** The vault item note this is, if any. */
  note?: EntityId;
  /** A line or two, written by the player or the DM. */
  description?: string;
  source?: ItemSource;
  givenByDm?: boolean;
  /** Given by the DM and not yet looked at by its owner. */
  unseen?: boolean;
}

export const COINS = ["cp", "sp", "ep", "gp", "pp"] as const;
export type Coin = (typeof COINS)[number];
export type Purse = Record<Coin, number>;
