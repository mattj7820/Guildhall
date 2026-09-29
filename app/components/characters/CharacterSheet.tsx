import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ABILITIES,
  ABILITY_NAMES,
  PASSIVE_SKILLS,
  signed,
  SKILL_ABILITIES,
  SKILL_NAMES,
  SKILLS,
  type Proficiency,
} from "~/characters/abilities";
import type { CharacterAction, TextField as TextFieldName } from "~/characters/actions";
import { deriveSheet, type DerivedSheet, type DerivedValue } from "~/characters/derive";
import {
  LEVEL_MAX,
  LONG_TEXT_MAX,
  NOTES_MAX,
  SCORE_MAX,
  SCORE_MIN,
  SHORT_TEXT_MAX,
} from "~/characters/schema";
import type { DerivedKey, PlayerCharacter, Sheet } from "~/characters/types";
import { CHARACTERS_URL, portraitUrl } from "~/characters/urls";
import { useCharacterEditor } from "~/characters/useCharacterEditor";
import type { CharacterPage } from "~/characters/view";
import { defaultRng } from "~/dice/rng";
import { useRollLog, type RollLogControls } from "~/dice/useRollLog";
import { DiceRoller } from "../combat/DiceRoller";
import { ItemIconSvg } from "../inventory/ItemTile";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "../styles";
import { EditorBar } from "./EditorBar";
import { NumberField, OverrideField, TextAreaField, TextField } from "./Fields";
import { HitPointsPanel } from "./HitPointsPanel";
import { Portrait } from "./Portrait";
import { SheetBag } from "./SheetBag";
import {
  Bonus,
  OverrideMark,
  ProficiencyMark,
  SheetPanel,
  sheetPanelClass,
  StatBox,
  TextBlock,
} from "./SheetParts";

type Dispatch = (...actions: CharacterAction[]) => void;

/** What the sheet's parts need: the sheet, its numbers, and how to change and roll them. */
interface Parts {
  sheet: Sheet;
  derived: DerivedSheet;
  editing: boolean;
  dispatch: Dispatch;
  roll: (label: string, bonus: number) => void;
}

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

function subtitle(sheet: Sheet): string {
  const parts = [
    sheet.species,
    sheet.className ? `${sheet.className} ${sheet.level}` : `Level ${sheet.level}`,
    sheet.background,
  ].filter(Boolean);
  return parts.join(" · ");
}

function HeaderFields({
  page,
  parts,
  text,
}: {
  page: CharacterPage;
  parts: Parts;
  text: (field: TextFieldName) => (value: string) => void;
}) {
  const { sheet, dispatch } = parts;
  return (
    <div className="mt-1 flex flex-wrap items-end gap-2">
      <TextField
        label="Name"
        showLabel
        value={sheet.name}
        placeholder={page.name}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("name")}
        className="w-40"
      />
      <TextField
        label="Species"
        showLabel
        value={sheet.species}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("species")}
        className="w-32"
      />
      <TextField
        label="Class"
        showLabel
        value={sheet.className}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("className")}
        className="w-32"
      />
      <NumberField
        label="Level"
        showLabel
        value={sheet.level}
        min={1}
        max={LEVEL_MAX}
        onCommit={(value) => dispatch({ type: "number", field: "level", value, from: sheet.level })}
      />
      <TextField
        label="Background"
        showLabel
        value={sheet.background}
        maxLength={SHORT_TEXT_MAX}
        onCommit={text("background")}
        className="w-32"
      />
      {page.portraitChoices && (
        <label className="flex flex-col gap-0.5 text-xs text-stone-600 dark:text-stone-400">
          Portrait
          <select
            value={sheet.portrait ?? ""}
            onChange={(event) =>
              dispatch({
                type: "portrait",
                value: event.target.value || undefined,
                from: sheet.portrait,
              })
            }
            className={`${inputClass} max-w-56`}
          >
            <option value="">From the character&rsquo;s note</option>
            {page.portraitChoices.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function AbilityScores({ parts }: { parts: Parts }) {
  const { sheet, derived, editing, dispatch, roll } = parts;
  return (
    <section aria-label="Ability scores" className="mt-4 grid grid-cols-3 gap-2 @xl:grid-cols-6">
      {ABILITIES.map((ability) => {
        const modifier = derived.modifiers[ability];
        const name = ABILITY_NAMES[ability];
        return (
          <div
            key={ability}
            className={`${sheetPanelClass} flex flex-col items-center py-2 text-center`}
          >
            <abbr
              title={name}
              className="text-xs font-semibold tracking-wide text-stone-500 uppercase no-underline"
            >
              {ability}
            </abbr>
            {editing ? (
              <>
                <span className="text-3xl font-bold tabular-nums">{signed(modifier)}</span>
                <NumberField
                  label={`${name} score`}
                  value={sheet.abilities[ability]}
                  min={SCORE_MIN}
                  max={SCORE_MAX}
                  onCommit={(value) =>
                    dispatch({ type: "ability", ability, value, from: sheet.abilities[ability] })
                  }
                />
              </>
            ) : (
              <>
                <RollButton
                  label={`${name} check`}
                  bonus={modifier}
                  roll={roll}
                  className="text-3xl font-bold"
                >
                  {signed(modifier)}
                </RollButton>
                <span className="rounded-full border border-stone-300 px-2 text-sm tabular-nums dark:border-stone-700">
                  {sheet.abilities[ability]}
                </span>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

function SavingThrows({ parts }: { parts: Parts }) {
  const { sheet, derived, editing, dispatch } = parts;
  return (
    <SheetPanel title="Saving throws">
      <ul className={editing ? "space-y-1" : "grid grid-cols-2 gap-x-4 gap-y-1"}>
        {ABILITIES.map((ability) => (
          <li key={ability} className="flex items-center gap-2 text-sm">
            {editing ? (
              <ProficiencyToggle
                name={`${ABILITY_NAMES[ability]} save`}
                value={sheet.saves[ability]}
                options={["none", "proficient"]}
                onChange={(value) =>
                  dispatch({ type: "save", ability, value, from: sheet.saves[ability] })
                }
              />
            ) : (
              <ProficiencyMark proficiency={sheet.saves[ability]} />
            )}
            <span className="mr-auto">{ABILITY_NAMES[ability]}</span>
            <DerivedNumber
              parts={parts}
              label={`${ABILITY_NAMES[ability]} save`}
              overrideKey={`save.${ability}`}
              value={derived.saves[ability]}
            />
          </li>
        ))}
      </ul>
    </SheetPanel>
  );
}

function SkillList({ parts }: { parts: Parts }) {
  const { sheet, derived, editing, dispatch } = parts;
  return (
    <SheetPanel title="Skills">
      <ul className="space-y-1">
        {SKILLS.map((skill) => (
          <li key={skill} className="flex items-center gap-2 text-sm">
            {editing ? (
              <ProficiencyToggle
                name={SKILL_NAMES[skill]}
                value={sheet.skills[skill]}
                options={["none", "proficient", "expertise"]}
                onChange={(value) =>
                  dispatch({ type: "skill", skill, value, from: sheet.skills[skill] })
                }
              />
            ) : (
              <ProficiencyMark proficiency={sheet.skills[skill]} />
            )}
            <span className="mr-auto">
              {SKILL_NAMES[skill]}{" "}
              <span className="text-xs text-stone-400 uppercase">{SKILL_ABILITIES[skill]}</span>
            </span>
            <DerivedNumber
              parts={parts}
              label={SKILL_NAMES[skill]}
              overrideKey={`skill.${skill}`}
              value={derived.skills[skill]}
            />
          </li>
        ))}
      </ul>
    </SheetPanel>
  );
}

function PassiveSenses({
  parts,
  text,
}: {
  parts: Parts;
  text: (field: TextFieldName) => (value: string) => void;
}) {
  const { sheet, derived, editing, dispatch } = parts;
  return (
    <SheetPanel title="Passive senses">
      <ul className="space-y-1 text-sm">
        {PASSIVE_SKILLS.map((skill) => {
          const value = derived.passives[skill];
          const key: DerivedKey = `passive.${skill}`;
          return (
            <li key={skill} className="flex items-center justify-between">
              <span>Passive {SKILL_NAMES[skill]}</span>
              {editing ? (
                <OverrideField
                  label={`Passive ${SKILL_NAMES[skill]}`}
                  value={sheet.overrides[key]}
                  computed={value.computed}
                  onCommit={(next) =>
                    dispatch({ type: "override", key, value: next, from: sheet.overrides[key] })
                  }
                />
              ) : (
                <span className="font-semibold tabular-nums">
                  {value.value}
                  {value.overridden && <OverrideMark computed={value.computed} />}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        {editing ? (
          <TextAreaField
            label="Senses"
            value={sheet.senses}
            maxLength={LONG_TEXT_MAX}
            rows={2}
            placeholder="Darkvision 60 ft."
            onCommit={text("senses")}
          />
        ) : (
          <TextBlock text={sheet.senses} empty="No other senses" />
        )}
      </div>
    </SheetPanel>
  );
}

function TextPanel({
  parts,
  title,
  field,
  text,
  empty,
}: {
  parts: Parts;
  title: string;
  field: "proficiencies" | "languages" | "defences" | "conditions";
  text: (field: TextFieldName) => (value: string) => void;
  empty?: string;
}) {
  return (
    <SheetPanel title={title}>
      {parts.editing ? (
        <TextAreaField
          label={title}
          value={parts.sheet[field]}
          maxLength={LONG_TEXT_MAX}
          rows={2}
          onCommit={text(field)}
        />
      ) : (
        <TextBlock text={parts.sheet[field]} empty={empty} />
      )}
    </SheetPanel>
  );
}

/**
 * A worked-out bonus: a roll button, or in edit mode a field to type over it (blank goes back to
 * the worked-out number).
 */
function DerivedNumber({
  parts,
  label,
  overrideKey,
  value,
  className = "font-semibold",
}: {
  parts: Parts;
  label: string;
  overrideKey: DerivedKey;
  value: DerivedValue;
  className?: string;
}) {
  const { sheet, editing, dispatch, roll } = parts;
  if (editing) {
    return (
      <OverrideField
        label={label}
        value={sheet.overrides[overrideKey]}
        computed={value.computed}
        onCommit={(next) =>
          dispatch({
            type: "override",
            key: overrideKey,
            value: next,
            from: sheet.overrides[overrideKey],
          })
        }
      />
    );
  }
  return (
    <RollButton label={label} bonus={value.value} roll={roll} className={className}>
      <Bonus value={value} />
    </RollButton>
  );
}

function RollButton({
  label,
  bonus,
  roll,
  className = "",
  children,
}: {
  label: string;
  bonus: number;
  roll: (label: string, bonus: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`Roll ${label}, ${signed(bonus)}`}
      title={`Roll ${label}`}
      onClick={() => roll(label, bonus)}
      className={`rounded px-1 hover:bg-amber-100 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-amber-900/40 dark:hover:text-amber-200 ${className}`}
    >
      {children}
    </button>
  );
}

const PROFICIENCY_NAMES: Record<Proficiency, string> = {
  none: "not proficient",
  proficient: "proficient",
  expertise: "expertise",
};

/** Cycles ○ → ● → ◉ (expertise only for skills). */
function ProficiencyToggle({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: Proficiency;
  options: Proficiency[];
  onChange: (value: Proficiency) => void;
}) {
  const next = options[(options.indexOf(value) + 1) % options.length];
  return (
    <button
      type="button"
      aria-label={`${name}: ${PROFICIENCY_NAMES[value]}. Change to ${PROFICIENCY_NAMES[next]}`}
      onClick={() => onChange(next)}
      className="rounded px-0.5 hover:bg-stone-100 dark:hover:bg-stone-800"
    >
      <ProficiencyMark proficiency={value} />
    </button>
  );
}

type Tab = "equipped" | "notes" | "story";

function SheetTabs({
  page,
  character,
  parts,
  text,
}: {
  page: CharacterPage;
  character: PlayerCharacter;
  parts: Parts;
  text: (field: TextFieldName) => (value: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("equipped");
  const id = useId();
  const tabs: { key: Tab; label: string }[] = [
    { key: "equipped", label: "Equipped" },
    { key: "notes", label: "Features & notes" },
    { key: "story", label: "Story" },
  ];
  const equipped = character.inventory.items.filter((item) => item.equipped);

  return (
    <section aria-label="More" className={sheetPanelClass}>
      <div
        role="tablist"
        aria-label="More"
        className="flex gap-4 border-b border-stone-200 text-sm dark:border-stone-700"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${id}-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              const at = tabs.findIndex((candidate) => candidate.key === tab);
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              const next = tabs[(at + step + tabs.length) % tabs.length].key;
              setTab(next);
              document.getElementById(`${id}-${next}-tab`)?.focus();
            }}
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
      <div
        role="tabpanel"
        id={`${id}-${tab}`}
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
        className="pt-3"
      >
        {tab === "equipped" &&
          (equipped.length > 0 ? (
            <ul className="space-y-1.5">
              {equipped.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <ItemIconSvg
                    icon={item.icon}
                    className="h-5 w-5 text-stone-600 dark:text-stone-300"
                  />
                  <span>{item.name}</span>
                  {item.attuned && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">attuned</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nothing equipped.</p>
          ))}
        {tab === "notes" &&
          (parts.editing ? (
            <TextAreaField
              label="Features & notes"
              value={character.sheet.notes}
              maxLength={NOTES_MAX}
              rows={8}
              placeholder="Features, traits, spells, anything else from the paper sheet"
              onCommit={text("notes")}
            />
          ) : (
            <TextBlock text={character.sheet.notes} empty="No notes yet." />
          ))}
        {tab === "story" &&
          (page.story ? (
            <>
              <div
                className="note-body prose prose-stone prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: page.story.html }}
              />
              <Link
                to={page.story.url}
                className="mt-2 inline-block text-sm text-amber-800 hover:underline dark:text-amber-400"
              >
                Open {page.story.title} in the wiki
              </Link>
            </>
          ) : (
            <p className="text-sm text-stone-500">The story isn&rsquo;t shared yet.</p>
          ))}
      </div>
    </section>
  );
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
