import { useEffect, useState } from "react";
import type { CombatCatalogue, StatblockView } from "./types";

/** Where a statblock is loaded from, by its key (`statblockKey`). */
export const statblockUrl = (key: string) => `/combat/statblock?key=${encodeURIComponent(key)}`;

type Fetch = (url: string) => Promise<Response>;

/** null: the statblock isn't there (or isn't the viewer's to see). */
type Loading = Promise<StatblockView | null>;

/**
 * Statblocks already loaded, kept with the catalogue they came with: a page that loads again (and
 * so gets a new catalogue) loads them again too, picking up edits to the vault.
 */
const caches = new WeakMap<CombatCatalogue, Map<string, Loading>>();

/**
 * Loads a statblock once per catalogue. A failure isn't kept, so the next try asks again; a
 * missing statblock is.
 */
export function loadStatblock(
  catalogue: CombatCatalogue,
  key: string,
  fetcher: Fetch = (url) => fetch(url, { headers: { Accept: "application/json" } }),
): Loading {
  let cache = caches.get(catalogue);
  if (!cache) caches.set(catalogue, (cache = new Map()));
  const known = cache.get(key);
  if (known) return known;
  const loading = fetcher(statblockUrl(key)).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Couldn't load the statblock (${response.status}).`);
    return (await response.json()) as StatblockView;
  });
  cache.set(key, loading);
  loading.catch(() => cache.delete(key));
  return loading;
}

export type StatblockState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; view: StatblockView }
  | { status: "missing" }
  | { status: "failed" };

/** The statblock for `key`, loading it if it hasn't been yet. */
export function useStatblock(catalogue: CombatCatalogue, key: string | undefined): StatblockState {
  const [state, setState] = useState<{ key?: string; state: StatblockState }>({
    state: { status: "none" },
  });
  useEffect(() => {
    if (!key) return;
    let current = true;
    loadStatblock(catalogue, key).then(
      (view) =>
        current &&
        setState({ key, state: view ? { status: "ready", view } : { status: "missing" } }),
      () => current && setState({ key, state: { status: "failed" } }),
    );
    return () => {
      current = false;
    };
  }, [catalogue, key]);
  if (!key) return { status: "none" };
  // Until the effect catches up with a new key, it's loading, never the last one's statblock.
  return state.key === key ? state.state : { status: "loading" };
}

/** Loads these statblocks ahead of time (everyone in the fight), so their turns show at once. */
export function usePrefetchStatblocks(catalogue: CombatCatalogue, keys: string[]): void {
  const joined = [...new Set(keys)].sort().join("\n");
  useEffect(() => {
    for (const key of joined ? joined.split("\n") : []) {
      loadStatblock(catalogue, key).catch(() => undefined);
    }
  }, [catalogue, joined]);
}
