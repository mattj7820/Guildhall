import { useState } from "react";
import { Link } from "react-router";
import { ABILITIES, ABILITY_NAMES, signed, type Ability } from "~/characters/abilities";
import { levelName, ORDINALS } from "~/characters/describe";
import type { Edits } from "~/characters/lists";
import { AREA_FEET_MAX, LONG_TEXT_MAX, SHORT_TEXT_MAX } from "~/characters/schema";
import {
  castActions,
  castNotice,
  castOptionLabel,
  castOptions,
  numbersFor,
  type CastOption,
} from "~/characters/spells";
import { startsPrepared } from "~/characters/preparing";
import { SPELL_LEVELS, type Spell, type SpellLevel } from "~/characters/types";
import type { CatalogueItem, LinkedNote } from "~/characters/view";
import { SPELL_SHAPES, type SpellShape } from "~/maps/grid/shapes";
import { newId } from "~/shared/ids";
import { buttonClass } from "../styles";
import {
  DiceField,
  NumberField,
  OverrideField,
  SelectField,
  TextAreaField,
  TextField,
} from "./Fields";
import { FilterChips } from "./FilterChips";
import { Pips } from "./Pips";
import { DiceChip, ListControls } from "./SheetLists";
import type { Parts } from "./SheetSections";

type SpellFilter = "all" | SpellLevel | "concentration" | "ritual";

/** Vault spell notes the viewer may link, and read. */
export interface SpellNotes {
  catalogue: CatalogueItem[];
  notes: Record<string, LinkedNote>;
}

/**
 * The character's spells by level (cantrips first), each level with its slots as pips. A spell's
 * attack and damage roll with a click, and Cast spends what it's cast with. Filters narrow it by
 * level, concentration or ritual.
 */
export function SpellsTab({
  parts,
  spellNotes = { catalogue: [], notes: {} },
  compact = false,
}: {
  parts: Parts;
  spellNotes?: SpellNotes;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<SpellFilter>("all");
  const [notice, setNotice] = useState<string>();
  const { sheet, editing } = parts;
  const levels = SPELL_LEVELS.filter((level) => sheet.spells.some((s) => s.level === level));
  const shown = sheet.spells.filter((spell) =>
    filter === "all"
      ? true
      : filter === "concentration"
        ? spell.concentration
        : filter === "ritual"
          ? spell.ritual
          : spell.level === filter,
  );

  return (
    <div className="flex flex-col gap-3">
      <Spellcasting parts={parts} />
      {sheet.spells.length > 0 && (
        <FilterChips<SpellFilter>
          label="Show spells"
          value={filter}
          onChange={setFilter}
          options={[
            ["all", "All"],
            ...levels.map((level) => [level, level === 0 ? "Cantrips" : ORDINALS[level]] as const),
            ["concentration", compact ? "Conc." : "Concentration"],
            ["ritual", "Ritual"],
          ]}
        />
      )}
      {notice && (
        <p role="status" className="text-sm text-info">
          {notice}
        </p>
      )}
      {sheet.spells.length === 0 && !editing && (
        <p className="text-sm text-muted">No spells yet. Edit the sheet to add them.</p>
      )}
      {levels
        .filter((level) => shown.some((spell) => spell.level === level))
        .map((level) => {
          const slot = level > 0 ? sheet.spellSlots[level - 1] : undefined;
          return (
            <section key={level} aria-label={levelName(level)}>
              <h3 className="flex items-center gap-3 border-b border-line pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {levelName(level)}
                {slot && slot.max > 0 && (
                  <Pips
                    label={`${ORDINALS[level]}-level slot`}
                    counter={slot}
                    size="sm"
                    onCount={(by) =>
                      parts.dispatch({
                        type: "count",
                        counter: { slot: level as Exclude<SpellLevel, 0> },
                        by,
                      })
                    }
                  />
                )}
              </h3>
              <ul>
                {shown
                  .filter((spell) => spell.level === level)
                  .map((spell) =>
                    editing ? (
                      <SpellForm
                        key={spell.id}
                        spell={spell}
                        parts={parts}
                        spellNotes={spellNotes}
                      />
                    ) : (
                      <SpellRow
                        key={spell.id}
                        spell={spell}
                        parts={parts}
                        note={spell.note ? spellNotes.notes[spell.note] : undefined}
                        compact={compact}
                        onNotice={setNotice}
                      />
                    ),
                  )}
              </ul>
            </section>
          );
        })}
      {editing && (
        <button
          type="button"
          className={`${buttonClass} self-start`}
          onClick={() =>
            parts.dispatch({
              type: "spells",
              change: {
                type: "add",
                item: {
                  id: newId(),
                  name: "New spell",
                  level: typeof filter === "number" ? filter : 0,
                  castingTime: "1 action",
                  range: "",
                  components: "",
                  duration: "",
                  concentration: false,
                  ritual: false,
                  attack: false,
                  prepared: startsPrepared(sheet),
                },
              },
            })
          }
        >
          Add spell
        </button>
      )}
    </div>
  );
}

/** The spellcasting ability, save DC and attack bonus; typed over while editing. */
function Spellcasting({ parts }: { parts: Parts }) {
  const { sheet, derived, editing, dispatch } = parts;
  const numbers = derived.spellcasting;
  if (editing) {
    return (
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <SelectField<Ability | "">
          label="Spellcasting ability"
          showLabel
          value={sheet.spellAbility ?? ""}
          options={[
            ["", "None"],
            ...ABILITIES.map((ability) => [ability, ABILITY_NAMES[ability]] as const),
          ]}
          onCommit={(value) =>
            dispatch({ type: "spellAbility", value: value || undefined, from: sheet.spellAbility })
          }
        />
        {numbers &&
          (
            [
              ["spell.dc", "Spell save DC", numbers.dc],
              ["spell.attack", "Spell attack bonus", numbers.attack],
            ] as const
          ).map(([key, label, value]) => (
            <label key={key} className="flex flex-col gap-0.5 text-xs text-muted">
              {label}
              <OverrideField
                label={label}
                value={sheet.overrides[key]}
                computed={value.computed}
                onCommit={(next) =>
                  dispatch({ type: "override", key, value: next, from: sheet.overrides[key] })
                }
              />
            </label>
          ))}
      </div>
    );
  }
  if (!numbers) {
    return sheet.spells.length > 0 ? (
      <p className="text-sm text-muted">
        Choose a spellcasting ability while editing to work out the save DC and attack.
      </p>
    ) : null;
  }
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span>
        Spellcasting <strong>{numbers.ability.toUpperCase()}</strong>
      </span>
      <span>
        Save DC <strong>{numbers.dc.value}</strong>
      </span>
      <span className="inline-flex items-center gap-1">
        Spell attack
        <DiceChip
          strong
          label={`Roll spell attack, ${signed(numbers.attack.value)}`}
          onRoll={() =>
            parts.rollDice({
              expression: `1d20${signed(numbers.attack.value)}`,
              kind: "attack",
              label: "Spell attack",
            })
          }
        >
          {signed(numbers.attack.value)}
        </DiceChip>
      </span>
    </p>
  );
}

function SpellRow({
  spell,
  parts,
  note,
  compact,
  onNotice,
}: {
  spell: Spell;
  parts: Parts;
  note?: LinkedNote;
  compact: boolean;
  onNotice: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const numbers = numbersFor(parts.sheet, parts.derived, spell);
  const meta = [spell.castingTime, spell.range, spell.components, spell.duration]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="border-b border-line py-1.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${spell.name}: details`}
          onClick={() => setOpen(!open)}
          className="mr-auto min-w-0 text-left"
        >
          <span className="font-medium">{spell.name}</span>
          {spell.concentration && <Badge title="Concentration">C</Badge>}
          {spell.ritual && <Badge title="Ritual">R</Badge>}
          {!compact && meta && <span className="ml-2 text-xs text-muted">{meta}</span>}
        </button>
        {spell.attack && numbers && (
          <DiceChip
            strong
            label={`Roll ${spell.name} attack, ${signed(numbers.attack.value)}`}
            onRoll={() =>
              parts.rollDice({
                expression: `1d20${signed(numbers.attack.value)}`,
                kind: "attack",
                label: `${spell.name} attack`,
              })
            }
          >
            {signed(numbers.attack.value)}
          </DiceChip>
        )}
        {spell.save && (
          <span className="text-xs font-semibold text-muted">
            {spell.save.toUpperCase()} {numbers?.dc.value ?? "save"}
          </span>
        )}
        {spell.roll && (
          <DiceChip
            label={`Roll ${spell.name}${spell.effect ? ` ${spell.effect}` : ""}, ${spell.roll}`}
            onRoll={() =>
              parts.rollDice({
                expression: spell.roll!,
                // A spell that attacks or asks for a save deals damage, which a critical doubles.
                kind: spell.attack || spell.save ? "damage" : "custom",
                label: `${spell.name}${spell.effect ? ` (${spell.effect})` : ""}`,
              })
            }
          >
            {spell.roll}
            {!compact && spell.effect && (
              <span className="ml-1 text-xs text-muted">{spell.effect}</span>
            )}
          </DiceChip>
        )}
        {spell.level > 0 && <CastButton spell={spell} parts={parts} onNotice={onNotice} />}
      </div>
      {open && (
        <div className="mt-1 space-y-1 pl-2 text-sm text-muted">
          {compact && meta && <p className="text-xs text-muted">{meta}</p>}
          {spell.save && <p className="text-xs">{ABILITY_NAMES[spell.save]} save</p>}
          {spell.area && (
            <p className="text-xs">
              Area: {spell.area.feet} ft. {spell.area.shape}
            </p>
          )}
          {spell.description && <p className="whitespace-pre-line">{spell.description}</p>}
          {note && (
            <div className="rounded border border-line p-2">
              <div
                // The note's title is in the link below it.
                className="note-body prose prose-theme prose-sm max-w-none [&>h1:first-child]:hidden"
                dangerouslySetInnerHTML={{ __html: note.html }}
              />
              <Link to={note.url} className="text-xs text-link hover:underline">
                Open {note.title} in the wiki
              </Link>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Badge({ title, children }: { title: string; children: string }) {
  return (
    <abbr
      title={title}
      className="ml-1 rounded border border-line-strong px-1 text-[10px] font-semibold text-muted no-underline"
    >
      {children}
    </abbr>
  );
}

/** Cast: the usual way in one click; ▾ for a higher slot, for free, or as a ritual. */
function CastButton({
  spell,
  parts,
  onNotice,
}: {
  spell: Spell;
  parts: Parts;
  onNotice: (text: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const options = castOptions(parts.sheet, spell);
  const [first] = options;

  function cast(option: CastOption) {
    onNotice(castNotice(parts.sheet, spell, option));
    parts.dispatch(...castActions(parts.sheet, spell, option));
    setMenu(false);
  }

  return (
    <span
      className="relative inline-flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenu(false);
      }}
    >
      <button
        type="button"
        aria-label={
          first ? `Cast ${spell.name}: ${castOptionLabel(first).toLowerCase()}` : undefined
        }
        disabled={!first}
        onClick={() => first && cast(first)}
        className="rounded-l-md bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:bg-line disabled:text-muted"
      >
        {first ? "Cast" : "No slots"}
      </button>
      <button
        type="button"
        aria-label={`Other ways to cast ${spell.name}`}
        aria-expanded={menu}
        disabled={options.length < 2}
        onClick={() => setMenu(!menu)}
        className="rounded-r-md border-l border-link/30 bg-accent px-1.5 text-sm text-on-accent hover:bg-accent-strong disabled:bg-line disabled:text-faint"
      >
        ▾
      </button>
      {menu && (
        <ul
          aria-label={`Ways to cast ${spell.name}`}
          className="absolute top-full right-0 z-20 mt-1 w-60 rounded-md border border-line bg-surface py-1 text-sm shadow-lg"
        >
          {options.map((option) => (
            <li key={castOptionLabel(option)}>
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-raised"
                onClick={() => cast(option)}
              >
                {castOptionLabel(option)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

const NEW_FREE_USE = "new";

/** A spell while editing: its details, what it rolls, and what casts it for free. */
function SpellForm({
  spell,
  parts,
  spellNotes,
}: {
  spell: Spell;
  parts: Parts;
  spellNotes: SpellNotes;
}) {
  const { sheet, dispatch } = parts;
  const set = (changes: Edits<Spell>) =>
    dispatch({ type: "spells", change: { type: "edit", id: spell.id, changes } });
  const withUses = sheet.features.filter((feature) => feature.uses);
  const index = sheet.spells.findIndex((each) => each.id === spell.id);
  const text = (
    field: "castingTime" | "range" | "components" | "duration",
    label: string,
    placeholder: string,
    width = "w-28",
  ) => (
    <TextField
      label={label}
      showLabel
      value={spell[field]}
      maxLength={SHORT_TEXT_MAX}
      placeholder={placeholder}
      className={width}
      onCommit={(value) => set({ [field]: value })}
    />
  );

  function chooseFreeUse(value: string) {
    if (value !== NEW_FREE_USE) {
      set({ freeUse: value || null });
      return;
    }
    // A feat's once a day, set up in one step: a feature with one use, and the spell cast by it.
    const id = newId();
    dispatch(
      {
        type: "features",
        change: {
          type: "add",
          item: {
            id,
            name: `${spell.name} (free)`,
            source: "feat",
            activation: "other",
            uses: { max: 1, used: 0, reset: "long" },
          },
        },
      },
      { type: "spells", change: { type: "edit", id: spell.id, changes: { freeUse: id } } },
    );
  }

  return (
    <li
      aria-label={spell.name}
      className="flex flex-col gap-2 border-b border-line py-2 last:border-0"
    >
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Name"
          showLabel
          value={spell.name}
          maxLength={SHORT_TEXT_MAX}
          className="w-44"
          onCommit={(name) => name && set({ name })}
        />
        <SelectField
          label="Level"
          showLabel
          value={String(spell.level)}
          options={SPELL_LEVELS.map(
            (level) => [String(level), level === 0 ? "Cantrip" : ORDINALS[level]] as const,
          )}
          onCommit={(level) => set({ level: Number(level) as SpellLevel })}
        />
        {text("castingTime", "Casting time", "1 action")}
        {text("range", "Range", "60 ft.", "w-20")}
        {text("components", "Components", "V, S, M", "w-24")}
        {text("duration", "Duration", "1 minute")}
        <ListControls
          name={spell.name}
          index={index}
          length={sheet.spells.length}
          onMove={(to) =>
            dispatch({ type: "spells", change: { type: "move", id: spell.id, index: to } })
          }
          onRemove={() => dispatch({ type: "spells", change: { type: "remove", id: spell.id } })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-sm">
        {(
          [
            ["concentration", "Concentration"],
            ["ritual", "Ritual"],
            ["attack", "Spell attack"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="flex items-center gap-1.5 pb-1.5">
            <input
              type="checkbox"
              checked={spell[field]}
              onChange={(event) => set({ [field]: event.target.checked })}
            />
            {label}
          </label>
        ))}
        <SelectField<Ability | "">
          label="Save"
          showLabel
          value={spell.save ?? ""}
          options={[
            ["", "None"],
            ...ABILITIES.map((ability) => [ability, ability.toUpperCase()] as const),
          ]}
          onCommit={(save) => set({ save: save || null })}
        />
        <DiceField
          label="Roll"
          showLabel
          value={spell.roll ?? ""}
          onCommit={(roll) => set({ roll: roll || null })}
        />
        <TextField
          label="Effect"
          showLabel
          value={spell.effect ?? ""}
          maxLength={SHORT_TEXT_MAX}
          placeholder="fire, healing"
          className="w-28"
          onCommit={(effect) => set({ effect: effect || null })}
        />
        <SelectField<SpellShape | "">
          label="Area"
          showLabel
          value={spell.area?.shape ?? ""}
          options={[["", "None"], ...SPELL_SHAPES.map((shape) => [shape, shape] as const)]}
          onCommit={(shape) =>
            set({ area: shape ? { shape, feet: spell.area?.feet ?? 15 } : null })
          }
        />
        {spell.area && (
          <NumberField
            label="Area in feet"
            showLabel
            value={spell.area.feet}
            min={1}
            max={AREA_FEET_MAX}
            onCommit={(feet) => set({ area: { shape: spell.area!.shape, feet } })}
          />
        )}
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-sm">
        <SelectField<Ability | "">
          label="Cast with"
          showLabel
          value={spell.ability ?? ""}
          options={[
            ["", "The sheet's ability"],
            ...ABILITIES.map((ability) => [ability, ABILITY_NAMES[ability]] as const),
          ]}
          onCommit={(ability) => set({ ability: ability || null })}
        />
        {spell.level > 0 && (
          <SelectField
            label="Free cast"
            showLabel
            value={spell.freeUse ?? ""}
            options={[
              ["", "None"],
              ...withUses.map((feature) => [feature.id, feature.name] as const),
              [NEW_FREE_USE, "New: once per long rest"],
            ]}
            onCommit={chooseFreeUse}
          />
        )}
        {spellNotes.catalogue.length > 0 && (
          <SelectField
            label="Wiki note"
            showLabel
            value={spell.note ?? ""}
            options={[
              ["", "None"],
              ...spellNotes.catalogue.map(
                (note) =>
                  [
                    note.id,
                    note.hiddenFromPlayers ? `${note.title} (DM only)` : note.title,
                  ] as const,
              ),
            ]}
            onCommit={(note) => {
              const title = spellNotes.catalogue.find((each) => each.id === note)?.title;
              set({
                note: note || null,
                // A new spell takes its note's name.
                ...(title && spell.name === "New spell" && { name: title }),
              });
            }}
          />
        )}
      </div>
      <TextAreaField
        label={`${spell.name} description`}
        value={spell.description ?? ""}
        maxLength={LONG_TEXT_MAX}
        rows={2}
        placeholder="What it does, in your own words"
        onCommit={(description) => set({ description: description || null })}
      />
    </li>
  );
}
