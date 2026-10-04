// PROTOTYPE (removed before the PR): where spells, slots, uses, hit dice and attacks sit on the
// full sheet: a Trackers strip under the hit points, and Actions and Spells tabs, wider than
// today's. Abilities, saves and skills stay as they are, so they're only outlined here.
import { useState } from "react";
import { Link } from "react-router";
import { signed } from "~/characters/abilities";
import { HitPointsPanel } from "~/components/characters/HitPointsPanel";
import { Portrait } from "~/components/characters/Portrait";
import { StatBox } from "~/components/characters/SheetParts";
import { DiceRoller } from "~/components/combat/DiceRoller";
import { buttonClass, panelClass } from "~/components/styles";
import { defaultRng } from "~/dice/rng";
import { useRollLog } from "~/dice/useRollLog";
import { protoDispatch } from "./CompactSheet";
import { protoActions, useProtoSheet } from "./model";
import {
  ActionsList,
  FeatureList,
  LatestRoll,
  PipStyleContext,
  PipStyleSwitch,
  SpellList,
  Trackers,
  type PipStyle,
} from "./parts";

type Tab = "actions" | "spells" | "features" | "notes" | "equipped" | "story";

const TABS: [Tab, string][] = [
  ["actions", "Actions"],
  ["spells", "Spells"],
  ["features", "Features"],
  ["notes", "Notes"],
  ["equipped", "Equipped"],
  ["story", "Story"],
];

export function SheetPrototype({ mapLink }: { mapLink?: string }) {
  const { sheet, canUndo } = useProtoSheet();
  const rolls = useRollLog(defaultRng);
  const [pipStyle, setPipStyle] = useState<PipStyle>("left");
  const [tab, setTab] = useState<Tab>("spells");
  const [notice, setNotice] = useState<string>();

  return (
    <PipStyleContext.Provider value={pipStyle}>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <strong>Prototype</strong>
          <PipStyleSwitch value={pipStyle} onChange={setPipStyle} />
          {mapLink && (
            <Link to={mapLink} className="text-amber-800 underline dark:text-amber-400">
              Back to the map
            </Link>
          )}
        </div>

        <header className="flex flex-wrap items-center gap-4">
          <Portrait name={sheet.name} size="lg" />
          <div className="mr-auto min-w-0">
            <h1 className="font-serif text-3xl font-bold">{sheet.name}</h1>
            <p className="text-stone-600 dark:text-stone-400">{sheet.subtitle}</p>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={!canUndo}
            onClick={() => protoActions.undo()}
          >
            Undo
          </button>
        </header>

        <div className="mt-4 rounded-lg border border-dashed border-stone-300 p-3 text-center text-sm text-stone-400 dark:border-stone-700">
          STR · DEX · CON · INT · WIS · CHA, as today
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_2fr]">
          <StatBox label="Proficiency">+2</StatBox>
          <StatBox label="Initiative">{signed(sheet.initiative)}</StatBox>
          <StatBox label="Armour class">{sheet.armourClass}</StatBox>
          <StatBox label="Speed">
            <span className="text-lg">{sheet.speed}</span>
          </StatBox>
          <HitPointsPanel
            hp={sheet.hp}
            editing={false}
            dispatch={protoDispatch}
            className="col-span-2 md:col-span-4 xl:col-span-1"
          />
        </div>

        <div className="mt-3">
          <Trackers sheet={sheet} />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-400 dark:border-stone-700">
              Saving throws, senses, proficiencies, languages and skills, as today
            </div>
            <DiceRoller rolls={rolls} hint="Or click any roll on the sheet." />
          </div>
          <section aria-label="More" className={`${panelClass} lg:col-span-2`}>
            <div
              role="tablist"
              aria-label="More"
              className="flex flex-wrap gap-4 border-b border-stone-200 text-sm dark:border-stone-700"
            >
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={
                    tab === key
                      ? "-mb-px border-b-2 border-amber-600 pb-2 font-semibold"
                      : "pb-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="pt-3">
              {tab === "actions" && <ActionsList sheet={sheet} rolls={rolls} />}
              {tab === "features" && <FeatureList sheet={sheet} rolls={rolls} />}
              {tab === "spells" && (
                <>
                  {notice && (
                    <p className="mb-2 text-sm text-sky-800 dark:text-sky-300">{notice}</p>
                  )}
                  <SpellList sheet={sheet} rolls={rolls} onNotice={setNotice} />
                </>
              )}
              {tab !== "actions" && tab !== "spells" && tab !== "features" && (
                <p className="text-sm text-stone-400">As today.</p>
              )}
            </div>
          </section>
        </div>
      </main>
      <LatestRoll rolls={rolls} floating />
    </PipStyleContext.Provider>
  );
}
