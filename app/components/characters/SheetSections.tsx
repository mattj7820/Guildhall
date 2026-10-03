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
import { type DerivedSheet, type DerivedValue } from "~/characters/derive";
import { LONG_TEXT_MAX, SCORE_MAX, SCORE_MIN } from "~/characters/schema";
import type { DerivedKey, Sheet } from "~/characters/types";
import { NumberField, OverrideField, TextAreaField } from "./Fields";
import {
  Bonus,
  OverrideMark,
  ProficiencyMark,
  SheetPanel,
  sheetPanelClass,
  TextBlock,
} from "./SheetParts";

export type Dispatch = (...actions: CharacterAction[]) => void;

/** What the sheet's parts need: the sheet, its numbers, and how to change and roll them. */
export interface Parts {
  sheet: Sheet;
  derived: DerivedSheet;
  editing: boolean;
  dispatch: Dispatch;
  roll: (label: string, bonus: number) => void;
}

export function AbilityScores({ parts }: { parts: Parts }) {
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

export function SavingThrows({ parts }: { parts: Parts }) {
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

export function SkillList({ parts }: { parts: Parts }) {
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

export function PassiveSenses({
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

export function TextPanel({
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
export function DerivedNumber({
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

export function RollButton({
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
export function ProficiencyToggle({
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
