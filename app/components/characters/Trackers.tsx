import type { ReactNode } from "react";
import { ORDINALS } from "~/characters/describe";
import { HIT_DICE_MAX, SLOTS_MAX } from "~/characters/schema";
import type { CounterRef } from "~/characters/tracking";
import { HIT_DICE, type SpellLevel } from "~/characters/types";
import { labelClass } from "../styles";
import { NumberField } from "./Fields";
import { Pips, ResetBadge } from "./Pips";
import type { Parts } from "./SheetSections";
import { sheetPanelClass } from "./SheetParts";

/**
 * Everything that gets used up, at a glance: spell slots by level, each feature's uses, hit dice
 * and concentration, with the rests beside them (`children`). Editing sets how many slots and hit
 * dice there are; a feature's uses are set on the feature. `compact` (beside the map) leaves
 * features' uses to the Actions list, where they're used.
 */
export function Trackers({
  parts,
  compact = false,
  children,
}: {
  parts: Parts;
  compact?: boolean;
  children?: ReactNode;
}) {
  const { sheet, editing, dispatch } = parts;
  const count = (counter: CounterRef) => (by: number) => dispatch({ type: "count", counter, by });
  const slots = sheet.spellSlots
    .map((slot, index) => ({ slot, level: (index + 1) as Exclude<SpellLevel, 0> }))
    .filter(({ slot }) => slot.max > 0);
  const hitDice = HIT_DICE.filter((die) => sheet.hitDice[die].max > 0);
  const uses = compact ? [] : sheet.features.filter((feature) => feature.uses);
  const size = compact ? "sm" : "md";

  if (editing && !compact) return <TrackerLimits parts={parts}>{children}</TrackerLimits>;

  const empty = slots.length === 0 && hitDice.length === 0 && uses.length === 0;
  return (
    <section
      aria-label="Trackers"
      className={compact ? "flex flex-col gap-2" : `${sheetPanelClass} mt-3 flex flex-col gap-3`}
    >
      {empty ? (
        <p className="text-sm text-stone-500">
          Nothing to track yet. Edit the sheet to set spell slots and hit dice, or give a feature
          uses.
        </p>
      ) : (
        <div
          className={`flex flex-wrap items-center ${compact ? "gap-x-3 gap-y-2" : "gap-x-6 gap-y-3"}`}
        >
          {slots.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={labelClass}>Slots</span>
              {slots.map(({ slot, level }) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-stone-500">{ORDINALS[level]}</span>
                  <Pips
                    label={`${ORDINALS[level]}-level slot`}
                    counter={slot}
                    onCount={count({ slot: level })}
                    size={size}
                  />
                </span>
              ))}
            </div>
          )}
          {uses.map((feature) => (
            <span key={feature.id} className="inline-flex items-center gap-1.5">
              <span className="text-sm">{feature.name}</span>
              <Pips
                label={feature.name}
                counter={feature.uses!}
                onCount={count({ feature: feature.id })}
                size={size}
              />
              <ResetBadge reset={feature.uses!.reset} />
            </span>
          ))}
        </div>
      )}
      <div
        className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${
          compact || empty ? "" : "border-t border-stone-100 pt-3 dark:border-stone-800"
        }`}
      >
        {hitDice.map((die) => (
          <span key={die} className="inline-flex items-center gap-1.5">
            <span className={labelClass}>Hit dice {die}</span>
            <Pips
              label={`${die} hit die`}
              counter={sheet.hitDice[die]}
              onCount={count({ hitDie: die })}
              size={size}
            />
          </span>
        ))}
        <Concentration parts={parts} />
        {children && <span className="ml-auto inline-flex gap-2">{children}</span>}
      </div>
    </section>
  );
}

/** What's being concentrated on, and dropping it. */
function Concentration({ parts }: { parts: Parts }) {
  const { sheet, dispatch } = parts;
  if (!sheet.concentrating) {
    return <span className="text-sm text-stone-400">Not concentrating</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-sm text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
      <span aria-hidden="true">◎</span>
      <span>
        Concentrating: <strong>{sheet.concentrating}</strong>
      </span>
      <button
        type="button"
        aria-label={`Stop concentrating on ${sheet.concentrating}`}
        onClick={() =>
          dispatch({ type: "text", field: "concentrating", value: "", from: sheet.concentrating })
        }
        className="text-xs underline"
      >
        Drop
      </button>
    </span>
  );
}

/** Editing: how many spell slots each level has, and hit dice of each size. */
function TrackerLimits({ parts, children }: { parts: Parts; children?: ReactNode }) {
  const { sheet, dispatch } = parts;
  return (
    <section aria-label="Trackers" className={`${sheetPanelClass} mt-3 flex flex-col gap-3`}>
      <fieldset className="flex flex-wrap items-end gap-2">
        <legend className={`${labelClass} mb-1`}>Spell slots</legend>
        {sheet.spellSlots.map((slot, index) => {
          const level = (index + 1) as Exclude<SpellLevel, 0>;
          return (
            <NumberField
              key={level}
              label={`${ORDINALS[level]}-level slots`}
              showLabel
              value={slot.max}
              min={0}
              max={SLOTS_MAX}
              className="w-14"
              onCommit={(value) =>
                dispatch({ type: "limit", counter: { slot: level }, value, from: slot.max })
              }
            />
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <fieldset className="flex flex-wrap items-end gap-2">
          <legend className={`${labelClass} mb-1`}>Hit dice</legend>
          {HIT_DICE.map((die) => (
            <NumberField
              key={die}
              label={`${die} hit dice`}
              showLabel
              value={sheet.hitDice[die].max}
              min={0}
              max={HIT_DICE_MAX}
              className="w-14"
              onCommit={(value) =>
                dispatch({
                  type: "limit",
                  counter: { hitDie: die },
                  value,
                  from: sheet.hitDice[die].max,
                })
              }
            />
          ))}
        </fieldset>
        {children && <span className="inline-flex gap-2">{children}</span>}
      </div>
    </section>
  );
}
