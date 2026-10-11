/**
 * Loading what the spell picker lists, and spells' text, when they're wanted rather than with
 * every sheet. Browser-side; the routes decide what each viewer may have.
 */
import { useEffect, useState } from "react";
import type { SpellOption } from "./spell-options";
import type { SpellText } from "./view";

export const SPELLS_URL = "/spells";
export const spellTextUrl = (key: string) => `/spells/text?key=${encodeURIComponent(key)}`;

type Fetch = (url: string) => Promise<Response>;
const json: Fetch = (url) => fetch(url, { headers: { Accept: "application/json" } });

/** Every spell the viewer may pick, fresh each time (the vault's notes change). */
export async function loadSpellOptions(fetcher: Fetch = json): Promise<SpellOption[]> {
  const response = await fetcher(SPELLS_URL);
  if (!response.ok) throw new Error(`Couldn't load the spells (${response.status}).`);
  return ((await response.json()) as { spells: SpellOption[] }).spells;
}

/** null: the text isn't there (or isn't the viewer's to read). */
type Loading = Promise<SpellText | null>;

/** SRD spells' text, which never changes; a note's is asked for each time, so edits show. */
const srdTexts = new Map<string, Loading>();

/** Loads a spell's text. A failure isn't kept, so the next try asks again. */
export function loadSpellText(key: string, fetcher: Fetch = json): Loading {
  const known = srdTexts.get(key);
  if (known) return known;
  const loading = fetcher(spellTextUrl(key)).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Couldn't load the spell (${response.status}).`);
    return (await response.json()) as SpellText;
  });
  if (key.startsWith("srd-")) {
    srdTexts.set(key, loading);
    loading.catch(() => srdTexts.delete(key));
  }
  return loading;
}

export type SpellTextState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; text: SpellText }
  | { status: "missing" }
  | { status: "failed" };

/** A spell's text: `known` if the page brought it, otherwise loaded for `key`. */
export function useSpellText(key: string | undefined, known?: SpellText): SpellTextState {
  const [state, setState] = useState<{ key?: string; state: SpellTextState }>({
    state: { status: "none" },
  });
  const needed = known ? undefined : key;
  useEffect(() => {
    if (!needed) return;
    let current = true;
    loadSpellText(needed).then(
      (text) =>
        current &&
        setState({ key: needed, state: text ? { status: "ready", text } : { status: "missing" } }),
      () => current && setState({ key: needed, state: { status: "failed" } }),
    );
    return () => {
      current = false;
    };
  }, [needed]);
  if (known) return { status: "ready", text: known };
  if (!key) return { status: "none" };
  return state.key === key ? state.state : { status: "loading" };
}
