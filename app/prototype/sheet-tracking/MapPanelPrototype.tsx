// PROTOTYPE (removed before the PR): a player's sheet and bag beside the map, in three layouts
// to compare: A, the map page's own panel with tabs; B, a drawer over the map; C, a small card
// over the map that opens the drawer. The map is the real one, with its tokens and battle tools;
// the fight's turn strip is pretend. Nothing is saved.
import { useEffect, useState, type ReactNode } from "react";
import { HitPointsPanel } from "~/components/characters/HitPointsPanel";
import { GridLayer } from "~/components/maps/GridLayer";
import { MapCanvas } from "~/components/maps/MapCanvas";
import { TokenLayer } from "~/components/maps/TokenLayer";
import { TurnStrip } from "~/components/combat/TurnStrip";
import { useBattleTools } from "~/components/maps/useBattleTools";
import { buttonClass, labelClass } from "~/components/styles";
import { defaultRng } from "~/dice/rng";
import { useRollLog } from "~/dice/useRollLog";
import type { TokenView } from "~/maps/tokens/types";
import type { MapView } from "~/maps/types";
import { CompactBag, CompactSheet, protoDispatch } from "./CompactSheet";
import { useProtoSheet } from "./model";
import {
  AttackList,
  LatestRoll,
  PipStyleContext,
  PipStyleSwitch,
  Trackers,
  type PipStyle,
} from "./parts";

type Layout = "aside" | "drawer" | "card";
type Tab = "map" | "sheet" | "bag";

const LAYOUTS: [Layout, string][] = [
  ["aside", "A · Tabs in the side panel"],
  ["drawer", "B · Drawer over the map"],
  ["card", "C · Card over the map"],
];

export function MapPanelPrototype({ map, tokens }: { map: MapView; tokens: TokenView[] }) {
  const { sheet, canUndo } = useProtoSheet();
  const rolls = useRollLog(defaultRng);
  const [layout, setLayout] = useState<Layout>("aside");
  const [pipStyle, setPipStyle] = useState<PipStyle>("left");
  const [tab, setTab] = useState<Tab>("sheet");
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<Exclude<Tab, "map">>();
  const [fighting, setFighting] = useState(true);
  const battle = useBattleTools({ map, tokens, enabled: true });

  // C for the sheet, I for the bag, as in games (V, M and A are the map's tools).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog, [role=dialog]"))
        return;
      const key = event.key.toLowerCase();
      const wanted: Tab | undefined = key === "c" ? "sheet" : key === "i" ? "bag" : undefined;
      if (!wanted) return;
      if (layout === "aside") {
        // Pressing it again goes back to the map's details.
        setTab(!collapsed && tab === wanted ? "map" : wanted);
        setCollapsed(false);
      } else {
        setDrawer((open) => (open === wanted ? undefined : wanted));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, collapsed, tab]);

  const turnOrder = [
    { id: "you", name: sheet.name, kind: "player" as const, isActive: true },
    ...tokens
      .filter((token) => token.kind === "character")
      .map((token) => ({
        id: token.id,
        name: token.name,
        kind: "player" as const,
        isActive: false,
      })),
    { id: "m1", name: "Monster 1", kind: "monster" as const, isActive: false },
    { id: "m2", name: "Monster 2", kind: "monster" as const, isActive: false },
  ];

  const sheetPanel = <CompactSheet sheet={sheet} rolls={rolls} canUndo={canUndo} />;
  const bagPanel = <CompactBag sheet={sheet} />;

  return (
    <PipStyleContext.Provider value={pipStyle}>
      <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <strong>Prototype</strong>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">Layout</legend>
            {LAYOUTS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="layout"
                  checked={layout === value}
                  onChange={() => {
                    setLayout(value);
                    setDrawer(undefined);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <PipStyleSwitch value={pipStyle} onChange={setPipStyle} />
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={fighting} onChange={() => setFighting(!fighting)} />
            Pretend fight
          </label>
          <span className="text-stone-500">Keys: C sheet · I bag · V M A map tools</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950">
          <div className="relative flex min-h-[50vh] min-w-0 flex-1">
            {battle.toolbar}
            {fighting && (
              <TurnStrip floating round={2} turnOrder={turnOrder}>
                <button type="button" className={`${buttonClass} pointer-events-auto`}>
                  End my turn
                </button>
              </TurnStrip>
            )}
            <MapCanvas name={map.name} size={map.size} imageUrl={map.image.url} className="flex-1">
              {(canvas) => (
                <>
                  {map.grid && <GridLayer grid={map.grid} size={map.size} />}
                  <TokenLayer
                    tokens={tokens}
                    size={map.size}
                    canvas={canvas}
                    grid={map.grid}
                    snap={map.snapToGrid}
                  />
                  {battle.layers(canvas)}
                </>
              )}
            </MapCanvas>

            {layout !== "aside" && (
              <div className="absolute top-3 right-3 z-10 flex gap-2">
                <button type="button" className={buttonClass} onClick={() => setDrawer("sheet")}>
                  Sheet <kbd className="text-xs opacity-60">C</kbd>
                </button>
                <button type="button" className={buttonClass} onClick={() => setDrawer("bag")}>
                  Bag <kbd className="text-xs opacity-60">I</kbd>
                </button>
              </div>
            )}

            {layout === "card" && !drawer && (
              <div className="absolute bottom-3 left-3 z-10 w-80 rounded-lg border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
                <div className="mb-2 flex items-center justify-between">
                  <strong className="font-serif">{sheet.name}</strong>
                  <button
                    type="button"
                    className="text-sm text-amber-800 hover:underline dark:text-amber-400"
                    onClick={() => setDrawer("sheet")}
                  >
                    More ▸
                  </button>
                </div>
                <HitPointsPanel hp={sheet.hp} editing={false} dispatch={protoDispatch} />
                <div className="mt-2">
                  <Trackers sheet={sheet} compact />
                </div>
                <div className="mt-2">
                  <AttackList sheet={sheet} rolls={rolls} compact />
                </div>
                <div className="mt-1">
                  <LatestRoll rolls={rolls} />
                </div>
              </div>
            )}

            {layout !== "aside" && drawer && (
              <aside
                aria-label="Your character"
                className="absolute inset-y-0 right-0 z-20 flex w-[26rem] max-w-full flex-col border-l border-stone-200 bg-stone-50 shadow-2xl dark:border-stone-800 dark:bg-stone-950"
              >
                <Tabs
                  tabs={[
                    ["sheet", "Sheet"],
                    ["bag", "Bag"],
                  ]}
                  value={drawer}
                  onChange={(value) => setDrawer(value as "sheet" | "bag")}
                  end={
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => setDrawer(undefined)}
                    >
                      Close
                    </button>
                  }
                />
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {drawer === "sheet" ? sheetPanel : bagPanel}
                </div>
              </aside>
            )}
          </div>

          {layout === "aside" && collapsed && (
            <nav
              aria-label="Side panel"
              className="flex flex-row gap-1 border-stone-200 p-1 md:flex-col md:border-l dark:border-stone-800"
            >
              {(
                [
                  ["map", "Map", "▦"],
                  ["sheet", "Sheet (C)", "☺"],
                  ["bag", "Bag (I)", "▣"],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    setTab(value);
                    setCollapsed(false);
                  }}
                  className="h-10 w-10 rounded text-lg hover:bg-stone-200 dark:hover:bg-stone-800"
                >
                  {icon}
                </button>
              ))}
            </nav>
          )}
          {layout === "aside" && !collapsed && (
            <aside
              aria-label="Side panel"
              className={`flex w-full flex-col border-stone-200 md:border-l dark:border-stone-800 ${
                tab === "map" ? "md:w-80" : "md:w-[26rem]"
              }`}
            >
              <Tabs
                tabs={[
                  ["map", "Map"],
                  ["sheet", "Sheet"],
                  ["bag", "Bag"],
                ]}
                value={tab}
                onChange={(value) => setTab(value as Tab)}
                end={
                  <button
                    type="button"
                    aria-label="Fold the panel away"
                    title="Fold away"
                    className={buttonClass}
                    onClick={() => setCollapsed(true)}
                  >
                    ⇥
                  </button>
                }
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "map" ? (
                  <MapDetailsPlaceholder />
                ) : tab === "sheet" ? (
                  sheetPanel
                ) : (
                  bagPanel
                )}
              </div>
            </aside>
          )}
          {layout !== "aside" && (
            <aside
              aria-label="Map details"
              className="w-full overflow-y-auto border-stone-200 p-4 md:w-80 md:border-l dark:border-stone-800"
            >
              <MapDetailsPlaceholder />
            </aside>
          )}
        </div>
        {layout === "drawer" && !drawer && <LatestRoll rolls={rolls} floating />}
      </main>
    </PipStyleContext.Provider>
  );
}

function Tabs({
  tabs,
  value,
  onChange,
  end,
}: {
  tabs: [string, string][];
  value: string;
  onChange: (value: string) => void;
  end?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-stone-200 px-2 pt-2 dark:border-stone-800">
      <div role="tablist" className="flex gap-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            onClick={() => onChange(key)}
            className={`rounded-t-md px-3 py-1.5 text-sm ${
              value === key
                ? "-mb-px border border-b-0 border-stone-200 bg-white font-semibold dark:border-stone-800 dark:bg-stone-900"
                : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="ml-auto pb-1">{end}</span>
    </div>
  );
}

function MapDetailsPlaceholder() {
  return (
    <div className="space-y-2 text-sm text-stone-500">
      <h2 className={labelClass}>Map details</h2>
      <p>As today: the map&rsquo;s note, the party here (Find, distances) and its places.</p>
    </div>
  );
}
