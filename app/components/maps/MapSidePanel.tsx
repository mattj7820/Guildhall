import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CHARACTERS_URL } from "~/characters/urls";
import { sheetDataUrl } from "~/characters/urls";
import type { CharacterChoice, CharacterPage } from "~/characters/view";
import { CharacterPanel, type PanelTab } from "../characters/CharacterPanel";
import { buttonClass, inputClass } from "../styles";
import { rememberedPanel, SidePanel, type SidePanelTab } from "./SidePanel";

type Tab = "map" | "sheet" | "bag";

const TABS: SidePanelTab<Tab>[] = [
  { key: "map", label: "Map", icon: "▦" },
  { key: "sheet", label: "Sheet", icon: "☺", shortcut: "C" },
  { key: "bag", label: "Bag", icon: "▣", shortcut: "I" },
];

/** What a viewer last had open, kept in their browser only. */
const panel = rememberedPanel<Tab>(
  "guildhall.mapPanel",
  TABS.map((each) => each.key),
  "map",
);

/**
 * A player's side panel on a map: the map's details, their sheet or their bag, so they needn't
 * leave the map mid-session. C opens the sheet and I the bag, as in games.
 */
export function MapSidePanel({
  characters,
  mapDetails,
}: {
  /** The characters this player may open: their own, and the companion the party shares. */
  characters: CharacterChoice[];
  mapDetails: ReactNode;
}) {
  const { tab, folded } = panel.use();
  const [chosenId, setChosenId] = useState(characters[0]?.id);
  const chosen = characters.find((each) => each.id === chosenId) ?? characters[0];
  const open = (next: Tab) => panel.remember({ tab: next, folded: false });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      const key = event.key.toLowerCase();
      const wanted: Tab | undefined = key === "c" ? "sheet" : key === "i" ? "bag" : undefined;
      if (!wanted) return;
      // Pressed again, it goes back to the map's details.
      const now = panel.current();
      panel.remember({ tab: !now.folded && now.tab === wanted ? "map" : wanted, folded: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidePanel
      label="Side panel"
      tabs={TABS}
      tab={tab}
      folded={folded}
      onOpen={open}
      onFold={() => panel.remember({ tab, folded: true })}
      extra={
        tab !== "map" &&
        characters.length > 1 &&
        chosen && (
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
        )
      }
    >
      {tab === "map" ? (
        mapDetails
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
    </SidePanel>
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
