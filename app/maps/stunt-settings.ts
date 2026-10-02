/**
 * Each viewer's own say over the DM's stunts: whether they're shown, whether sounds play, and how
 * loud. Kept in the browser (it's this person on this device), and never needed: without storage,
 * everything is on at the usual volume. Isomorphic.
 */
import { useCallback, useEffect, useState } from "react";

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

/** This viewer's stunt settings, read once the page is in the browser, and saved as they change. */
export function useStuntSettings() {
  const [settings, setSettings] = useState(DEFAULT_STUNT_SETTINGS);
  useEffect(() => {
    try {
      setSettings(readStuntSettings(localStorage.getItem(KEY)));
    } catch {
      // Storage blocked: the defaults stand.
    }
  }, []);
  const change = useCallback((next: Partial<StuntSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(updated));
      } catch {
        // Kept for this page only.
      }
      return updated;
    });
  }, []);
  return { settings, change };
}
