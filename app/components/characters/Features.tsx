import { useState } from "react";
import type { FeatureEdits } from "~/characters/actions";
import { ACTIVATION_NAMES, RESET_NAMES, SOURCE_NAMES } from "~/characters/describe";
import { LONG_TEXT_MAX, SHORT_TEXT_MAX, USES_MAX } from "~/characters/schema";
import {
  ACTIVATIONS,
  FEATURE_SOURCES,
  RESETS,
  type Activation,
  type Feature,
  type FeatureSource,
} from "~/characters/types";
import { newId } from "~/shared/ids";
import { buttonClass, labelClass } from "../styles";
import { DiceField, NumberField, SelectField, TextField } from "./Fields";
import { FilterChips } from "./FilterChips";
import { Pips, ResetBadge } from "./Pips";
import { DiceChip, ListControls } from "./SheetLists";
import type { Parts } from "./SheetSections";

/**
 * A feature: its name (click for its note), where it's from, its uses as pips, and its roll.
 * Editing turns it into a small form.
 */
export function FeatureRow({
  feature,
  parts,
  compact = false,
  showActivation = false,
}: {
  feature: Feature;
  parts: Parts;
  compact?: boolean;
  showActivation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (parts.editing) return <FeatureForm feature={feature} parts={parts} />;
  const { uses } = feature;
  return (
    <li
      className={`border-b border-stone-100 last:border-0 dark:border-stone-800 ${compact ? "py-1" : "py-1.5"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={feature.note ? open : undefined}
          onClick={() => setOpen(!open)}
          disabled={!feature.note}
          className="mr-auto min-w-0 text-left disabled:cursor-default"
        >
          <span className="font-medium">{feature.name}</span>
          <span className="ml-2 text-[11px] text-stone-500">
            {feature.sourceName || SOURCE_NAMES[feature.source]}
          </span>
          {showActivation && (
            <span className="ml-2 text-[11px] text-stone-400">
              {ACTIVATION_NAMES[feature.activation]}
            </span>
          )}
        </button>
        {uses && (
          <span className="inline-flex items-center gap-1.5">
            <Pips
              label={feature.name}
              counter={uses}
              size="sm"
              onCount={(by) =>
                parts.dispatch({ type: "count", counter: { feature: feature.id }, by })
              }
            />
            <ResetBadge reset={uses.reset} />
          </span>
        )}
        {feature.roll && (
          <DiceChip
            label={`Roll ${feature.name}, ${feature.roll}`}
            onRoll={() =>
              parts.rollDice({ expression: feature.roll!, kind: "custom", label: feature.name })
            }
          >
            {feature.roll}
          </DiceChip>
        )}
      </div>
      {open && feature.note && (
        <p className="mt-0.5 pl-2 text-sm whitespace-pre-line text-stone-600 dark:text-stone-300">
          {feature.note}
        </p>
      )}
    </li>
  );
}

function FeatureForm({ feature, parts }: { feature: Feature; parts: Parts }) {
  const edit = (changes: FeatureEdits) =>
    parts.dispatch({ type: "features", change: { type: "edit", id: feature.id, changes } });
  const list = parts.sheet.features;
  return (
    <li
      aria-label={feature.name}
      className="flex flex-col gap-2 border-b border-stone-200 py-2 last:border-0 dark:border-stone-700"
    >
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Name"
          showLabel
          value={feature.name}
          maxLength={SHORT_TEXT_MAX}
          className="w-44"
          onCommit={(name) => name && edit({ name })}
        />
        <SelectField
          label="From"
          showLabel
          value={feature.source}
          options={FEATURE_SOURCES.map((source) => [source, SOURCE_NAMES[source]] as const)}
          onCommit={(source) => edit({ source })}
        />
        <TextField
          label="Which (optional)"
          showLabel
          value={feature.sourceName ?? ""}
          maxLength={SHORT_TEXT_MAX}
          placeholder={feature.source === "item" ? "The item's name" : ""}
          className="w-36"
          onCommit={(text) => edit({ sourceName: text || null })}
        />
        <SelectField
          label="Used as"
          showLabel
          value={feature.activation}
          options={ACTIVATIONS.map(
            (activation) => [activation, ACTIVATION_NAMES[activation]] as const,
          )}
          onCommit={(activation) => edit({ activation })}
        />
        <DiceField
          label="Roll"
          showLabel
          value={feature.roll ?? ""}
          onCommit={(roll) => edit({ roll: roll || null })}
        />
        <ListControls
          name={feature.name}
          index={list.findIndex((each) => each.id === feature.id)}
          length={list.length}
          onMove={(index) =>
            parts.dispatch({ type: "features", change: { type: "move", id: feature.id, index } })
          }
          onRemove={() =>
            parts.dispatch({ type: "features", change: { type: "remove", id: feature.id } })
          }
        />
      </div>
      <TextField
        label={`${feature.name} note`}
        value={feature.note ?? ""}
        maxLength={LONG_TEXT_MAX}
        placeholder="A line to remind you what it does"
        onCommit={(note) => edit({ note: note || null })}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!feature.uses}
            onChange={(event) =>
              edit({ uses: event.target.checked ? { max: 1, reset: "long" } : null })
            }
          />
          Limited uses
        </label>
        {feature.uses && (
          <>
            <NumberField
              label={`${feature.name}: how many uses`}
              value={feature.uses.max}
              min={1}
              max={USES_MAX}
              onCommit={(max) => edit({ uses: { max, reset: feature.uses!.reset } })}
            />
            <SelectField
              label={`${feature.name}: comes back on`}
              value={feature.uses.reset}
              options={RESETS.map((reset) => [reset, RESET_NAMES[reset]] as const)}
              onCommit={(reset) => edit({ uses: { max: feature.uses!.max, reset } })}
            />
          </>
        )}
      </div>
    </li>
  );
}

/** Adds a feature, ready to be filled in, in the editor. */
export function AddFeature({
  parts,
  activation = "action",
  source = "class",
}: {
  parts: Parts;
  activation?: Activation;
  source?: FeatureSource;
}) {
  return (
    <button
      type="button"
      className={`${buttonClass} self-start`}
      onClick={() =>
        parts.dispatch({
          type: "features",
          change: {
            type: "add",
            item: { id: newId(), name: "New feature", source, activation },
          },
        })
      }
    >
      Add feature
    </button>
  );
}

type SourceFilter = "all" | FeatureSource;

/**
 * Every feature, trait and item power, passive ones included, by where it comes from: a reminder
 * of everything the character has.
 */
export function FeaturesTab({ parts, compact = false }: { parts: Parts; compact?: boolean }) {
  const [filter, setFilter] = useState<SourceFilter>("all");
  const { features } = parts.sheet;
  const present = FEATURE_SOURCES.filter((source) => features.some((f) => f.source === source));
  const groups = present
    .filter((source) => filter === "all" || filter === source)
    .map((source) => ({ source, features: features.filter((f) => f.source === source) }));

  return (
    <div className="flex flex-col gap-3">
      {present.length > 1 && (
        <FilterChips<SourceFilter>
          label="Show features"
          value={filter}
          onChange={setFilter}
          options={[
            ["all", "All"],
            ...present.map((source) => [source, SOURCE_NAMES[source]] as const),
          ]}
        />
      )}
      {features.length === 0 && (
        <p className="text-sm text-stone-500">
          No features yet.{" "}
          {parts.editing
            ? ""
            : "Edit the sheet to add class features, species traits, feats and items' powers."}
        </p>
      )}
      {groups.map(({ source, features: inGroup }) => (
        <section key={source} aria-label={SOURCE_NAMES[source]}>
          <h3 className={labelClass}>{source === "item" ? "From items" : SOURCE_NAMES[source]}</h3>
          <ul>
            {inGroup.map((feature) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                parts={parts}
                compact={compact}
                showActivation
              />
            ))}
          </ul>
        </section>
      ))}
      {parts.editing && (
        <AddFeature
          parts={parts}
          source={filter === "all" ? "class" : filter}
          activation="passive"
        />
      )}
    </div>
  );
}
