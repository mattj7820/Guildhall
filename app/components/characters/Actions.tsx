import { useState } from "react";
import { signed } from "~/characters/abilities";
import { ACTIVATION_NAMES } from "~/characters/describe";
import type { Edits } from "~/characters/lists";
import { ATTACK_BONUS_LIMIT, LONG_TEXT_MAX, SHORT_TEXT_MAX } from "~/characters/schema";
import { ACTIVATIONS, type Activation, type Attack } from "~/characters/types";
import { newId } from "~/shared/ids";
import { buttonClass, labelClass } from "../styles";
import { DiceField, NumberField, TextField } from "./Fields";
import { AddFeature, FeatureRow } from "./Features";
import { FilterChips } from "./FilterChips";
import { DiceChip, ListControls } from "./SheetLists";
import type { Parts } from "./SheetSections";

type Used = Exclude<Activation, "passive">;
type ActionFilter = "all" | "attack" | Used | "limited";

const USED = ACTIVATIONS.filter((activation): activation is Used => activation !== "passive");

/** Headings for features by how they're used: "Bonus actions", "Reactions"… */
const GROUP_NAMES: Record<Used, string> = {
  action: "Actions",
  bonus: "Bonus actions",
  reaction: "Reactions",
  other: "Other",
};

/**
 * Everything the character can do in play: attacks first, then features by how they're used,
 * each feature with its uses where it's used. Filters narrow it, as on D&D Beyond's sheet.
 */
export function ActionsTab({ parts, compact = false }: { parts: Parts; compact?: boolean }) {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const { attacks, features } = parts.sheet;
  const groups = USED.map((activation) => ({
    activation,
    features: features.filter(
      (feature) =>
        feature.activation === activation &&
        (filter === "all" || filter === activation || (filter === "limited" && !!feature.uses)),
    ),
  })).filter((group) => group.features.length > 0);
  const showAttacks = filter === "all" || filter === "attack" || filter === "action";
  const nothing = attacks.length === 0 && !features.some((f) => f.activation !== "passive");

  return (
    <div className="flex flex-col gap-3">
      <FilterChips<ActionFilter>
        label="Show actions"
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "All"],
          ["attack", "Attack"],
          ["action", "Action"],
          ["bonus", compact ? "Bonus" : ACTIVATION_NAMES.bonus],
          ["reaction", "Reaction"],
          ["other", "Other"],
          ["limited", compact ? "Limited" : "Limited use"],
        ]}
      />
      {nothing && !parts.editing && (
        <p className="text-sm text-muted">
          No attacks or features yet. Edit the sheet to add them.
        </p>
      )}
      {showAttacks && (attacks.length > 0 || parts.editing) && (
        <section aria-label="Attacks">
          <h3 className={labelClass}>Attacks</h3>
          <AttackList parts={parts} compact={compact} />
        </section>
      )}
      {filter !== "attack" &&
        groups.map(({ activation, features: inGroup }) => (
          <section key={activation} aria-label={GROUP_NAMES[activation]}>
            <h3 className={labelClass}>{GROUP_NAMES[activation]}</h3>
            <ul>
              {inGroup.map((feature) => (
                <FeatureRow key={feature.id} feature={feature} parts={parts} compact={compact} />
              ))}
            </ul>
          </section>
        ))}
      {parts.editing && filter !== "attack" && (
        <AddFeature
          parts={parts}
          activation={filter === "all" || filter === "limited" ? "action" : filter}
        />
      )}
    </div>
  );
}

/** Attacks: name, to hit and damage, each rolled with a click; fields while editing. */
function AttackList({ parts, compact }: { parts: Parts; compact: boolean }) {
  const { attacks } = parts.sheet;
  return (
    <>
      <ul className="divide-y divide-line">
        {attacks.map((attack, index) =>
          parts.editing ? (
            <AttackForm key={attack.id} attack={attack} index={index} parts={parts} />
          ) : (
            <li
              key={attack.id}
              className={`flex flex-wrap items-center gap-2 ${compact ? "py-1" : "py-1.5"}`}
            >
              <span className="mr-auto min-w-0">
                <span className="font-medium">{attack.name}</span>
                {attack.notes && !compact && (
                  <span className="ml-2 text-xs text-muted">{attack.notes}</span>
                )}
              </span>
              <DiceChip
                strong
                label={`Roll ${attack.name} attack, ${signed(attack.bonus)}`}
                onRoll={() =>
                  parts.rollDice({
                    expression: `1d20${signed(attack.bonus)}`,
                    kind: "attack",
                    label: `${attack.name} attack`,
                  })
                }
              >
                {signed(attack.bonus)}
              </DiceChip>
              {attack.damage && (
                <DiceChip
                  label={`Roll ${attack.name} damage, ${attack.damage}`}
                  onRoll={() =>
                    parts.rollDice({
                      expression: attack.damage,
                      kind: "damage",
                      label: `${attack.name} damage`,
                    })
                  }
                >
                  {attack.damage}
                  {attack.damageType && !compact && (
                    <span className="ml-1 text-xs text-muted">{attack.damageType}</span>
                  )}
                </DiceChip>
              )}
            </li>
          ),
        )}
      </ul>
      {parts.editing && (
        <button
          type="button"
          className={`${buttonClass} mt-2`}
          onClick={() =>
            parts.dispatch({
              type: "attacks",
              change: {
                type: "add",
                item: { id: newId(), name: "New attack", bonus: 0, damage: "" },
              },
            })
          }
        >
          Add attack
        </button>
      )}
    </>
  );
}

function AttackForm({ attack, index, parts }: { attack: Attack; index: number; parts: Parts }) {
  const set = (changes: Edits<Attack>) =>
    parts.dispatch({ type: "attacks", change: { type: "edit", id: attack.id, changes } });
  return (
    <li aria-label={attack.name} className="flex flex-wrap items-end gap-2 py-2">
      <TextField
        label="Name"
        showLabel
        value={attack.name}
        maxLength={SHORT_TEXT_MAX}
        className="w-40"
        onCommit={(name) => name && set({ name })}
      />
      <NumberField
        label="To hit"
        showLabel
        value={attack.bonus}
        min={-ATTACK_BONUS_LIMIT}
        max={ATTACK_BONUS_LIMIT}
        onCommit={(bonus) => set({ bonus })}
      />
      <DiceField
        label="Damage"
        showLabel
        value={attack.damage}
        onCommit={(damage) => set({ damage })}
      />
      <TextField
        label="Type"
        showLabel
        value={attack.damageType ?? ""}
        maxLength={SHORT_TEXT_MAX}
        placeholder="slashing"
        className="w-28"
        onCommit={(damageType) => set({ damageType: damageType || null })}
      />
      <TextField
        label="Notes"
        showLabel
        value={attack.notes ?? ""}
        maxLength={LONG_TEXT_MAX}
        placeholder="Range, properties"
        className="w-44"
        onCommit={(notes) => set({ notes: notes || null })}
      />
      <ListControls
        name={attack.name}
        index={index}
        length={parts.sheet.attacks.length}
        onMove={(to) =>
          parts.dispatch({ type: "attacks", change: { type: "move", id: attack.id, index: to } })
        }
        onRemove={() =>
          parts.dispatch({ type: "attacks", change: { type: "remove", id: attack.id } })
        }
      />
    </li>
  );
}
