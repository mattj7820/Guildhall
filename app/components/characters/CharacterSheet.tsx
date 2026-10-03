import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { signed } from "~/characters/abilities";
import type { TextField as TextFieldName } from "~/characters/actions";
import { deriveSheet } from "~/characters/derive";
import { SHORT_TEXT_MAX } from "~/characters/schema";
import type { PlayerCharacter } from "~/characters/types";
import { CHARACTERS_URL, portraitUrl } from "~/characters/urls";
import { useCharacterEditor } from "~/characters/useCharacterEditor";
import type { CharacterPage } from "~/characters/view";
import { defaultRng } from "~/dice/rng";
import { useRollLog, type RollLogControls } from "~/dice/useRollLog";
import { DiceRoller } from "../combat/DiceRoller";
import { buttonClass, panelClass, primaryButtonClass } from "../styles";
import { EditorBar } from "./EditorBar";
import { NumberField, TextField } from "./Fields";
import { HitPointsPanel } from "./HitPointsPanel";
import { Portrait } from "./Portrait";
import { SheetBag } from "./SheetBag";
import { HeaderFields, subtitle } from "./SheetHeader";
import {
  AbilityScores,
  DerivedNumber,
  type Parts,
  PassiveSenses,
  SavingThrows,
  SkillList,
  TextPanel,
} from "./SheetSections";
import { SheetTabs } from "./SheetTabs";
import { StatBox } from "./SheetParts";

/**
 * A player character's sheet, laid out like the paper one: abilities across the top, then saves
 * and senses, skills, and combat numbers with tabs for everything else. Every bonus rolls a d20
 * when clicked; Edit turns the same places into fields. Changes save in the background.
 */
export function CharacterSheet({ page }: { page: CharacterPage }) {
  const editor = useCharacterEditor(page.character);
  const character = editor.character as PlayerCharacter;
  const sheet = character.sheet;
  const derived = deriveSheet(sheet);
  const rolls = useRollLog(defaultRng);
  const [editing, setEditing] = useState(false);
  const { open: bagOpen, toggle: toggleBag, button: bagButton } = useBagToggle();

  const name = sheet.name.trim() || page.name;
  const portraitPath = sheet.portrait ?? page.notePortrait;
  const parts: Parts = {
    sheet,
    derived,
    editing,
    dispatch: editor.dispatch,
    roll: (label, bonus) =>
      rolls.roll({
        expression: bonus === 0 ? "1d20" : `1d20${signed(bonus)}`,
        kind: "check",
        label: `${name} · ${label}`,
      }),
  };
  const text = (field: TextFieldName) => (value: string) =>
    editor.dispatch({ type: "text", field, value, from: sheet[field] });

  return (
    <main className={`mx-auto px-4 py-6 ${bagOpen ? "max-w-[100rem]" : "max-w-7xl"}`}>
      <div
        className={
          bagOpen ? "lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-6" : ""
        }
      >
        <div className="@container min-w-0">
          <p className="mb-3 text-sm">
            <Link
              to={CHARACTERS_URL}
              className="text-stone-600 hover:underline dark:text-stone-400"
            >
              ← Characters
            </Link>
          </p>

          <header className="flex flex-wrap items-center gap-4">
            <Portrait
              name={name}
              url={portraitPath ? portraitUrl(character.id, portraitPath) : undefined}
              size="lg"
            />
            <div className="mr-auto min-w-0">
              <h1 className="font-serif text-3xl font-bold">{name}</h1>
              {editing ? (
                <HeaderFields page={page} parts={parts} text={text} />
              ) : (
                <p className="text-stone-600 dark:text-stone-400">{subtitle(sheet)}</p>
              )}
            </div>
            <button
              type="button"
              aria-pressed={sheet.heroicInspiration}
              onClick={() =>
                editor.dispatch({
                  type: "inspiration",
                  value: !sheet.heroicInspiration,
                  from: sheet.heroicInspiration,
                })
              }
              className={`rounded-full border px-3 py-1 text-sm ${sheet.heroicInspiration ? "border-amber-400 bg-amber-100 font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200" : "border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400"}`}
            >
              {sheet.heroicInspiration ? "★ " : "☆ "}Heroic inspiration
            </button>
            <button
              ref={bagButton}
              type="button"
              aria-expanded={bagOpen}
              aria-controls="bag-panel"
              onClick={() => toggleBag()}
              className={primaryButtonClass}
            >
              {bagOpen ? "Close bag" : "Bag"} <kbd className="ml-1 text-xs opacity-70">I</kbd>
            </button>
          </header>

          <EditorBar editor={editor}>
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => {
                if (editing) editor.flush();
                setEditing(!editing);
              }}
              className={editing ? primaryButtonClass : buttonClass}
            >
              {editing ? "Done editing" : "Edit sheet"}
            </button>
          </EditorBar>

          <AbilityScores parts={parts} />

          <div className="mt-3 grid grid-cols-2 gap-2 @xl:grid-cols-4 @5xl:grid-cols-[repeat(4,minmax(0,1fr))_2fr]">
            <StatBox label="Proficiency">
              {editing ? (
                <NumberField
                  label="Proficiency bonus"
                  value={sheet.proficiencyBonus}
                  min={0}
                  max={10}
                  onCommit={(value) =>
                    editor.dispatch({
                      type: "number",
                      field: "proficiencyBonus",
                      value,
                      from: sheet.proficiencyBonus,
                    })
                  }
                />
              ) : (
                signed(sheet.proficiencyBonus)
              )}
            </StatBox>
            <StatBox label="Initiative">
              <DerivedNumber
                parts={parts}
                label="Initiative"
                overrideKey="initiative"
                value={derived.initiative}
                className="text-2xl font-bold"
              />
            </StatBox>
            <StatBox label="Armour class">
              {editing ? (
                <NumberField
                  label="Armour class"
                  value={sheet.armourClass}
                  min={0}
                  max={50}
                  onCommit={(value) =>
                    editor.dispatch({
                      type: "number",
                      field: "armourClass",
                      value,
                      from: sheet.armourClass,
                    })
                  }
                />
              ) : (
                sheet.armourClass
              )}
            </StatBox>
            <StatBox label="Speed">
              {editing ? (
                <TextField
                  label="Speed"
                  value={sheet.speed}
                  maxLength={SHORT_TEXT_MAX}
                  onCommit={text("speed")}
                  className="w-24 text-center text-base"
                />
              ) : (
                <span className="text-lg">{sheet.speed || "—"}</span>
              )}
            </StatBox>
            <HitPointsPanel
              hp={sheet.hp}
              editing={editing}
              dispatch={editor.dispatch}
              className="col-span-2 @xl:col-span-4 @5xl:col-span-1"
            />
          </div>

          <div className="mt-3 grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
            <div className="space-y-3">
              <SavingThrows parts={parts} />
              <PassiveSenses parts={parts} text={text} />
              <TextPanel parts={parts} title="Proficiencies" field="proficiencies" text={text} />
              <TextPanel parts={parts} title="Languages" field="languages" text={text} />
            </div>
            <SkillList parts={parts} />
            <div className="space-y-3 @3xl:col-span-2 @6xl:col-span-1">
              <DiceRoller
                rolls={rolls}
                hint="Or click any bonus on the sheet. Advantage and disadvantage last one d20 roll."
              />
              <TextPanel parts={parts} title="Defences" field="defences" text={text} />
              <TextPanel
                parts={parts}
                title="Conditions"
                field="conditions"
                text={text}
                empty="None"
              />
              <SheetTabs page={page} character={character} parts={parts} text={text} />
            </div>
          </div>
        </div>
        {bagOpen && (
          <aside
            id="bag-panel"
            aria-labelledby="bag-heading"
            className={`${panelClass} fixed inset-0 z-30 overflow-y-auto rounded-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:rounded-lg`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="bag-heading" className="font-serif text-2xl font-bold">
                Bag
              </h2>
              <button type="button" className={buttonClass} onClick={() => toggleBag(false)}>
                <span className="lg:hidden">Back to sheet</span>
                <span className="hidden lg:inline">Close</span>
              </button>
            </div>
            <SheetBag editor={editor} page={page} />
          </aside>
        )}
      </div>
      <LatestRoll rolls={rolls} />
    </main>
  );
}

/**
 * The bag beside the sheet: open in the URL (`?bag`), so a reload or a link keeps it open, and
 * toggled with I, as in games, when not typing.
 */
function useBagToggle() {
  const [params, setParams] = useSearchParams();
  const open = params.has("bag");
  const button = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(
    (next?: boolean) => {
      const opening = next ?? !open;
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (opening) updated.set("bag", "");
          else updated.delete("bag");
          return updated;
        },
        { replace: true, preventScrollReset: true },
      );
      if (!opening) button.current?.focus();
    },
    [open, setParams],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "i" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { open, toggle, button };
}

/**
 * The latest roll, floating at the bottom of the screen for a few seconds, so it's seen wherever
 * the click was. Screen readers hear it from the dice panel already.
 */
function LatestRoll({ rolls }: { rolls: RollLogControls }) {
  const latest = rolls.log.rolls[0];
  if (!latest) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-4"
    >
      <p
        key={latest.id}
        className="animate-[fade_4s_ease-in_forwards] rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 shadow-lg dark:bg-stone-100 dark:text-stone-900"
      >
        {latest.label}: <strong className="text-lg">{latest.result.total}</strong>
        {latest.result.natural === 20 && " · Natural 20!"}
        {latest.result.natural === 1 && " · Natural 1"}
      </p>
    </div>
  );
}
