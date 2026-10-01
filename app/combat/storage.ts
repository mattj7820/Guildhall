import { encounterSchema } from "./schema";
import type { Encounter } from "./types";

/**
 * Keeps the in-progress encounter in the browser's localStorage so a reload doesn't lose it.
 * What comes back is validated: storage can hold anything (an old format, a hand edit).
 */
export const ENCOUNTER_STORAGE_KEY = "guildhall:encounter";

export type LoadResult =
  | { status: "empty" }
  | { status: "restored"; encounter: Encounter }
  /** Something was saved but can't be used; the DM is told rather than it being dropped silently. */
  | { status: "unreadable" };

export function loadEncounter(storage: Pick<Storage, "getItem">): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(ENCOUNTER_STORAGE_KEY);
  } catch {
    return { status: "unreadable" };
  }
  if (raw === null) return { status: "empty" };
  try {
    const parsed = encounterSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { status: "restored", encounter: parsed.data }
      : { status: "unreadable" };
  } catch {
    return { status: "unreadable" };
  }
}

/** The browser's localStorage, or undefined where it's unavailable (even reading it can throw). */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Forgets the encounter kept here, once it's been brought over to the server (or declined). */
export function clearEncounter(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(ENCOUNTER_STORAGE_KEY);
  } catch {
    // Nothing more to do: it'll be offered again next time.
  }
}

/** Returns false if the browser refused (storage full or disabled), so the page can say so. */
export function saveEncounter(storage: Pick<Storage, "setItem">, encounter: Encounter): boolean {
  try {
    storage.setItem(ENCOUNTER_STORAGE_KEY, JSON.stringify(encounter));
    return true;
  } catch {
    return false;
  }
}
