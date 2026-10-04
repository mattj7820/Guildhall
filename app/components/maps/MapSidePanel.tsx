import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router";
import { CHARACTERS_URL } from "~/characters/urls";
import { sheetDataUrl } from "~/characters/urls";
import type { CharacterChoice, CharacterPage } from "~/characters/view";
import { CharacterPanel, type PanelTab } from "../characters/CharacterPanel";
import { buttonClass, iconButtonClass, inputClass } from "../styles";

type Tab = "map" | "sheet" | "bag";

const TABS: { key: Tab; label: string; icon: string; shortcut?: string }[] = [
  { key: "map", label: "Map", icon: "▦" },
  { key: "sheet", label: "Sheet", icon: "☺", shortcut: "C" },
  { key: "bag", label: "Bag", icon: "▣", shortcut: "I" },
];

/** What a viewer last had open, kept in their browser only. */
const REMEMBERED = "guildhall.mapPanel";

/**
 * A player's side panel on a map: the map's details, their sheet or their bag, so they needn't
 * leave the map mid-session. It keeps one width whatever's open, so the map doesn't jump, and
 * folds away to a strip of icons for more map. C opens the sheet and I the bag, as in games.
 */
export function MapSidePanel({
  characters,
  mapDetails,
}: {
  /** The characters this player may open: their own, and the companion the party shares. */
  characters: CharacterChoice[];
  mapDetails: ReactNode;
}) {
  const { tab, folded } = useSyncExternalStore(subscribe, current, () => FIRST);
  const [chosenId, setChosenId] = useState(characters[0]?.id);
  const chosen = characters.find((each) => each.id === chosenId) ?? characters[0];
  const open = (next: Tab) => remember({ tab: next, folded: false });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      const key = event.key.toLowerCase();
      const wanted: Tab | undefined = key === "c" ? "sheet" : key === "i" ? "bag" : undefined;
      if (!wanted) return;
      // Pressed again, it goes back to the map's details.
      const now = current();
      remember({ tab: !now.folded && now.tab === wanted ? "map" : wanted, folded: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (folded) {
    return (
      <nav
        aria-label="Side panel"
        className="flex flex-row gap-1 border-stone-200 p-1 md:flex-col md:border-l dark:border-stone-800"
      >
        {TABS.map(({ key, label, icon, shortcut }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            title={shortcut ? `${label} (${shortcut})` : label}
            onClick={() => open(key)}
            className="h-10 w-10 rounded text-lg hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            {icon}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside
      aria-label="Side panel"
      className="flex w-full flex-col border-stone-200 md:w-[26rem] md:shrink-0 md:border-l dark:border-stone-800"
    >
      <div className="flex items-center gap-1 border-b border-stone-200 px-2 pt-2 dark:border-stone-800">
        <div role="tablist" aria-label="Side panel" className="flex gap-1">
          {TABS.map(({ key, label, shortcut }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              title={shortcut ? `${label} (${shortcut})` : undefined}
              onClick={() => open(key)}
              className={`rounded-t-md px-3 py-1.5 text-sm ${
                tab === key
                  ? "-mb-px border border-b-0 border-stone-200 bg-white font-semibold dark:border-stone-800 dark:bg-stone-900"
                  : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== "map" && characters.length > 1 && chosen && (
          <select
            aria-label="Whose"
            value={chosen.id}
            onChange={(event) => setChosenId(event.target.value)}
            className={`${inputClass} ml-2 mb-1 max-w-[9rem] py-0.5`}
          >
            {characters.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-label="Fold the panel away"
          title="Fold away"
          className={`${iconButtonClass} mb-1 ml-auto`}
          onClick={() => remember({ tab, folded: true })}
        >
          ⇥
        </button>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "map" ? (
          <div className="flex flex-col gap-4">{mapDetails}</div>
        ) : !chosen ? (
          <p className="text-sm text-stone-500">
            No sheet yet.{" "}
            <Link to={CHARACTERS_URL} className="text-amber-800 underline dark:text-amber-400">
              Start one on the Characters page
            </Link>
            .
          </p>
        ) : (
          <LoadedCharacter key={chosen.id} id={chosen.id} tab={tab} />
        )}
      </div>
    </aside>
  );
}

/**
 * A character's sheet, fetched when it's first opened beside the map (the map page itself carries
 * only names), through the same checks as the sheet page. One editor per character, kept while
 * switching between its sheet and bag.
 */
function LoadedCharacter({ id, tab }: { id: string; tab: PanelTab }) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "loaded"; page: CharacterPage } | { kind: "failed" }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetch(sheetDataUrl(id), { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? (response.json() as Promise<CharacterPage>) : undefined))
      .catch(() => undefined)
      .then((page) => {
        if (current) setState(page ? { kind: "loaded", page } : { kind: "failed" });
      });
    return () => {
      current = false;
    };
  }, [id, attempt]);

  if (state.kind === "loading") return <p className="text-sm text-stone-500">Opening…</p>;
  if (state.kind === "failed") {
    return (
      <p className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400">
        The sheet couldn&rsquo;t be opened.
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt(attempt + 1);
          }}
        >
          Try again
        </button>
      </p>
    );
  }
  return <CharacterPanel page={state.page} tab={tab} />;
}

interface PanelState {
  tab: Tab;
  folded: boolean;
}

const FIRST: PanelState = { tab: "map", folded: false };

/*
 * What's open is kept in the browser, so it stays open from one map to the next and across a
 * reload: the map's details on the server and while hydrating, then what was open last. If
 * storage is blocked, it's kept for this page only.
 */
const listeners = new Set<() => void>();
let pageOnly: PanelState | undefined;
let last: { saved: string | null; state: PanelState } | undefined;

function current(): PanelState {
  if (pageOnly) return pageOnly;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(REMEMBERED);
  } catch {
    // Storage blocked: the map's details, as at first.
  }
  if (!last || last.saved !== saved) last = { saved, state: parse(saved) };
  return last.state;
}

function parse(saved: string | null): PanelState {
  try {
    const value = JSON.parse(saved ?? "null");
    if (TABS.some((each) => each.key === value?.tab) && typeof value.folded === "boolean") {
      return { tab: value.tab, folded: value.folded };
    }
  } catch {
    // Damaged: start again.
  }
  return FIRST;
}

function remember(next: PanelState) {
  try {
    localStorage.setItem(REMEMBERED, JSON.stringify(next));
    pageOnly = undefined;
  } catch {
    pageOnly = next;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
