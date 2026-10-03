/**
 * Each viewer's own say over the DM's stunts: whether they're shown, whether sounds play, and how
 * loud. Kept in the browser (it's this person on this device), and never needed: without storage,
 * everything is on at the usual volume. Isomorphic.
 */
import { useCallback, useSyncExternalStore } from "react";

export interface StuntSettings {
  effects: boolean;
  sound: boolean;
  /** 0 to 1. */
  volume: number;
}

export const DEFAULT_STUNT_SETTINGS: StuntSettings = { effects: true, sound: true, volume: 0.8 };
const KEY = "guildhall.stunts";

/** Reads settings saved earlier, keeping the defaults for anything missing or damaged. */
export function readStuntSettings(saved: string | null): StuntSettings {
  if (!saved) return DEFAULT_STUNT_SETTINGS;
  try {
    const value = JSON.parse(saved) as Partial<Record<keyof StuntSettings, unknown>>;
    const volume = typeof value.volume === "number" ? value.volume : NaN;
    return {
      effects: typeof value.effects === "boolean" ? value.effects : DEFAULT_STUNT_SETTINGS.effects,
      sound: typeof value.sound === "boolean" ? value.sound : DEFAULT_STUNT_SETTINGS.sound,
      volume: Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : DEFAULT_STUNT_SETTINGS.volume,
    };
  } catch {
    return DEFAULT_STUNT_SETTINGS;
  }
}

/**
 * This viewer's stunt settings: the defaults on the server and while hydrating, then what this
 * browser saved (also when another tab changes them). Saved as they change; if storage is
 * blocked, kept for this page only.
 */
export function useStuntSettings() {
  const settings = useSyncExternalStore(subscribe, current, () => DEFAULT_STUNT_SETTINGS);
  const change = useCallback((next: Partial<StuntSettings>) => {
    const updated = { ...current(), ...next };
    try {
      localStorage.setItem(KEY, JSON.stringify(updated));
      pageOnly = undefined;
    } catch {
      pageOnly = updated;
    }
    for (const listener of listeners) listener();
  }, []);
  return { settings, change };
}

const listeners = new Set<() => void>();
/** Settings that couldn't be saved, because storage is blocked. */
let pageOnly: StuntSettings | undefined;
/** The last settings read, by what was stored, so an unchanged store gives the same object. */
let last: { saved: string | null; settings: StuntSettings } | undefined;

function current(): StuntSettings {
  if (pageOnly) return pageOnly;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: the defaults stand.
  }
  if (!last || last.saved !== saved) last = { saved, settings: readStuntSettings(saved) };
  return last.settings;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
