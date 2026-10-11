import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { ABILITY_NAMES } from "~/characters/abilities";
import { levelName, ORDINALS } from "~/characters/describe";
import { findSpells, spellClasses } from "~/characters/find-spells";
import {
  noteSpellKey,
  pickedSpell,
  SPELL_TAGS,
  spellTag,
  srdSpellKey,
  type SpellOption,
  type SpellTag,
} from "~/characters/spell-options";
import { loadSpellOptions, useSpellText } from "~/characters/spell-texts";
import { SPELL_LEVELS, type SpellLevel } from "~/characters/types";
import type { SpellText } from "~/characters/view";
import { newId } from "~/shared/ids";
import { buttonClass, inputClass, labelClass } from "../styles";
import { FilterChips } from "./FilterChips";
import { Badge } from "./SheetLists";
import type { Parts } from "./SheetSections";

/** Rows shown at once: enough to browse, few enough to stay quick; searching narrows the rest. */
const SHOWN = 100;

/** The table plays 2024 rules, with 2014's on hand (the DM's choice from the prototype). */
const STARTING_TAGS: SpellTag[] = ["Mine", "2024"];

type LevelFilter = "any" | SpellLevel;

type Loaded =
  { status: "loading" } | { status: "failed" } | { status: "ready"; spells: SpellOption[] };

/**
 * Adding spells to a sheet from the SRD's and the DM's own spell notes: search by name, chips for
 * where it's from, filters for level, class, concentration and rituals, a row that opens to the
 * spell's text, and + to add it, filled in and linked (or Enter for the one picked with the arrow
 * keys). The list is loaded when the picker opens. Narrow (beside a map), the columns make way.
 */
export function SpellPicker({
  parts,
  compact,
  undo,
  onType,
  onDone,
}: {
  parts: Parts;
  compact: boolean;
  undo?: () => void;
  /** Adds a blank spell to type in, for one that isn't here (while editing). */
  onType?: () => void;
  onDone: () => void;
}) {
  const ids = useId();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<ReadonlySet<SpellTag>>(new Set(STARTING_TAGS));
  const [level, setLevel] = useState<LevelFilter>("any");
  const [className, setClassName] = useState("");
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [pickedKey, setPickedKey] = useState<string>();
  const [openKey, setOpenKey] = useState<string>();
  const [added, setAdded] = useState<string>();

  useEffect(() => {
    let current = true;
    loadSpellOptions().then(
      (spells) => current && setLoaded({ status: "ready", spells }),
      () => current && setLoaded({ status: "failed" }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const spells = useMemo(() => (loaded.status === "ready" ? loaded.spells : []), [loaded]);
  const classes = useMemo(() => spellClasses(spells), [spells]);
  const found = useMemo(
    () =>
      findSpells(spells, {
        query,
        tags,
        level: level === "any" ? undefined : level,
        className,
        concentration,
        ritual,
      }),
    [spells, query, tags, level, className, concentration, ritual],
  );
  const shown = found.slice(0, SHOWN);
  const searching = query.trim() !== "";
  // Searching picks the best match, so Enter adds it straight away.
  const picked = shown.find((s) => s.key === pickedKey) ?? (searching ? shown[0] : undefined);
  const onSheet = new Set(
    parts.sheet.spells.flatMap((spell) => [
      ...(spell.srd ? [srdSpellKey(spell.srd)] : []),
      ...(spell.note ? [noteSpellKey(spell.note)] : []),
    ]),
  );

  function add(option: SpellOption | undefined) {
    if (!option) return;
    const spell = pickedSpell(option, newId(), parts.sheet);
    parts.dispatch({ type: "spells", change: { type: "add", item: spell } });
    const ready =
      spell.level === 0
        ? "a cantrip, always ready"
        : spell.prepared
          ? "prepared"
          : "not prepared (no room under the number to prepare)";
    setAdded(`Added ${option.name} (${spellTag(option)}), ${ready}.`);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add(picked);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = picked ? shown.indexOf(picked) : -1;
    const next = shown[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) setPickedKey(next.key);
  }

  function toggle(tag: SpellTag) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    // Turning the last one off would show nothing; show everything instead.
    setTags(next.size ? next : new Set(SPELL_TAGS));
  }

  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      on ? "bg-accent text-on-accent" : "bg-raised text-muted hover:bg-line"
    }`;

  return (
    <section
      aria-labelledby={`${ids}-heading`}
      className="@container flex flex-col gap-2 rounded-md border border-line p-3"
    >
      <div className="flex items-center gap-2">
        <h3 id={`${ids}-heading`} className={`${labelClass} mr-auto`}>
          Add spells
        </h3>
        <button type="button" className={buttonClass} onClick={onDone}>
          Done
        </button>
      </div>
      <input
        type="search"
        aria-label="Find a spell"
        aria-controls={`${ids}-list`}
        placeholder="Find a spell… (↑↓ to pick, Enter adds)"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPickedKey(undefined);
        }}
        onKeyDown={keys}
        className={inputClass}
      />
      <div role="group" aria-label="Where from" className="flex flex-wrap gap-1">
        {SPELL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.has(tag)}
            onClick={() => toggle(tag)}
            className={chip(tags.has(tag))}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {compact ? (
          <select
            aria-label="Level"
            value={String(level)}
            onChange={(event) =>
              setLevel(
                event.target.value === "any" ? "any" : (Number(event.target.value) as SpellLevel),
              )
            }
            className={`${inputClass} py-0.5`}
          >
            <option value="any">Any level</option>
            {SPELL_LEVELS.map((each) => (
              <option key={each} value={each}>
                {levelName(each)}
              </option>
            ))}
          </select>
        ) : (
          <FilterChips<LevelFilter>
            label="Level"
            value={level}
            onChange={setLevel}
            options={[
              ["any", "Any level"],
              ...SPELL_LEVELS.map((each) => [each, each === 0 ? "Cantrip" : String(each)] as const),
            ]}
          />
        )}
        <select
          aria-label="Class"
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          className={`${inputClass} py-0.5`}
        >
          <option value="">Any class</option>
          {classes.map((each) => (
            <option key={each}>{each}</option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={concentration}
          onClick={() => setConcentration(!concentration)}
          className={chip(concentration)}
        >
          {compact ? "Conc." : "Concentration"}
        </button>
        <button
          type="button"
          aria-pressed={ritual}
          onClick={() => setRitual(!ritual)}
          className={chip(ritual)}
        >
          Ritual
        </button>
      </div>

      <ul
        id={`${ids}-list`}
        aria-label="Spells found"
        className="max-h-[28rem] overflow-y-auto rounded-md border border-line"
      >
        {loaded.status === "loading" && <li className="p-3 text-sm text-muted">Loading spells…</li>}
        {loaded.status === "failed" && (
          <li className="p-3 text-sm text-danger">
            Couldn&rsquo;t load the spells.{" "}
            <button
              type="button"
              className="font-semibold text-link hover:underline"
              onClick={() => {
                setLoaded({ status: "loading" });
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </button>
          </li>
        )}
        {loaded.status === "ready" && shown.length === 0 && (
          <li className="p-3 text-sm text-muted">Nothing matches.</li>
        )}
        {shown.map((spell, index) => {
          const heading = !searching && (index === 0 || spell.level !== shown[index - 1].level);
          return [
            heading && (
              <li
                key={`level-${spell.level ?? "none"}`}
                className="sticky top-0 bg-raised px-2 py-0.5 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {spell.level === undefined ? "No level given" : levelName(spell.level)}
              </li>
            ),
            <PickerRow
              key={spell.key}
              spell={spell}
              showLevel={searching}
              picked={spell === picked}
              open={openKey === spell.key}
              onSheet={onSheet.has(spell.key)}
              onOpen={() => {
                setOpenKey(openKey === spell.key ? undefined : spell.key);
                setPickedKey(spell.key);
              }}
              onAdd={() => add(spell)}
            />,
          ];
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {found.length > SHOWN
          ? `Showing ${SHOWN} of ${found.length}. Search or filter to find the rest.`
          : loaded.status === "ready" && `${found.length} found.`}
        <span className="ml-auto">
          Not here?{" "}
          {onType ? (
            <button
              type="button"
              className="font-semibold text-link hover:underline"
              onClick={onType}
            >
              Type one in
            </button>
          ) : compact ? (
            "Type it in on the full sheet."
          ) : (
            "Edit the sheet to type one in."
          )}
        </span>
      </p>
      {added && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-info">
          {added}
          {undo && (
            <button
              type="button"
              className="font-semibold text-link hover:underline"
              onClick={() => {
                undo();
                setAdded(undefined);
              }}
            >
              Undo
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function PickerRow({
  spell,
  showLevel,
  picked,
  open,
  onSheet,
  onOpen,
  onAdd,
}: {
  spell: SpellOption;
  /** While searching there are no level headings, so each row says its level. */
  showLevel: boolean;
  picked: boolean;
  open: boolean;
  onSheet: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const tag = spellTag(spell);
  return (
    <li
      className={`border-b border-line px-2 py-1 text-sm last:border-b-0 ${
        picked ? "bg-accent-surface" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${spell.name} (${tag}): details`}
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <span aria-hidden className="mr-1 text-faint">
            {open ? "▾" : "▸"}
          </span>
          <span className="font-medium">{spell.name}</span>
          {spell.concentration && <Badge title="Concentration">C</Badge>}
          {spell.ritual && <Badge title="Ritual">R</Badge>}
        </button>
        {showLevel && (
          <span className="w-12 text-right text-xs text-muted">
            {spell.level === undefined
              ? "–"
              : spell.level === 0
                ? "Cantrip"
                : ORDINALS[spell.level]}
          </span>
        )}
        {/* Columns as there's room: none beside a map; all of them on a wide sheet. */}
        <span className="hidden w-24 truncate text-xs text-muted @lg:block">
          {spell.castingTime.split(", which")[0]}
        </span>
        <span className="hidden w-20 truncate text-xs text-muted @2xl:block">{spell.range}</span>
        <span className="hidden w-10 text-xs font-semibold text-muted uppercase @md:block">
          {spell.save ?? (spell.attack ? "atk" : "")}
        </span>
        <span
          className={`rounded px-1.5 text-xs font-semibold ${
            tag === "Mine" ? "bg-accent text-on-accent" : "border border-line text-muted"
          }`}
        >
          {tag}
          {spell.hiddenFromPlayers && " · DM only"}
        </span>
        <span className="w-4 text-center text-good" title={onSheet ? "On the sheet" : undefined}>
          {onSheet && (
            <>
              <span aria-hidden>✓</span>
              <span className="sr-only">On the sheet</span>
            </>
          )}
        </span>
        <button
          type="button"
          aria-label={`Add ${spell.name} (${tag})`}
          onClick={onAdd}
          className={`${buttonClass} px-2 py-0`}
        >
          +
        </button>
      </div>
      {open && (
        <div className="mt-1 mb-1 ml-4 space-y-1">
          <p className="text-xs text-muted">{facts(spell)}</p>
          <SpellTextBox spellKey={spell.key} />
        </div>
      )}
    </li>
  );
}

/** What a spell would fill in, in one line. */
function facts(spell: SpellOption): string {
  return [
    spell.castingTime.split(", which")[0],
    spell.range,
    spell.components,
    spell.duration,
    spell.save && `${ABILITY_NAMES[spell.save]} save`,
    spell.attack && "Spell attack",
    spell.roll && `${spell.roll}${spell.effect ? ` ${spell.effect}` : ""}`,
    spell.area && `${spell.area.feet} ft. ${spell.area.shape}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A spell's text, from the SRD or a vault note, as the viewer may read it: what the page brought
 * (`known`), or loaded when it's shown.
 */
export function SpellTextBox({ spellKey, known }: { spellKey: string; known?: SpellText }) {
  const state = useSpellText(spellKey, known);
  if (state.status === "loading") return <p className="text-xs text-muted">Loading…</p>;
  if (state.status === "failed") {
    return (
      <p className="text-xs text-danger">Couldn&rsquo;t load its text. Open it again to retry.</p>
    );
  }
  if (state.status !== "ready") return null;
  const { text } = state;
  return (
    <div className="rounded border border-line p-2">
      <div
        // The note's title is in the line below it.
        className="note-body prose prose-theme prose-sm max-w-none [&>h1:first-child]:hidden"
        dangerouslySetInnerHTML={{ __html: text.html }}
      />
      {text.url ? (
        <Link to={text.url} className="text-xs text-link hover:underline">
          Open {text.source} in the wiki
        </Link>
      ) : (
        <p className="text-xs text-faint">{text.source}, CC BY 4.0</p>
      )}
    </div>
  );
}
