import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { addMonsters, type EncounterAction } from "~/combat/encounter";
import {
  CHALLENGE_RATINGS,
  CREATURE_TAGS,
  creatureTypes,
  findCreatures,
  tagOf,
  type CreatureTag,
} from "~/combat/find-creatures";
import type { CombatCatalogue, CreatureOption } from "~/combat/types";
import type { Rng } from "~/dice/rng";
import { buttonClass, inputClass, labelClass } from "~/components/styles";
import { StatblockPanel } from "./StatblockPanel";

/** Rows shown at once: enough to browse, few enough to stay quick; searching narrows the rest. */
const SHOWN = 100;

/**
 * Finding a monster among the vault's statblocks and the SRD's, and adding it: search by name,
 * filter by where it's from, challenge rating and type, then + on its row (or Enter for the one
 * picked with the arrow keys). Each adds "How many", rolling hit points unless Max HP is typed.
 * Narrow (beside a map), the type and size columns make way.
 */
export function MonsterPicker({
  catalogue,
  dispatch,
  rng,
  mode,
}: {
  catalogue: CombatCatalogue;
  dispatch: (action: EncounterAction) => void;
  rng: Rng;
  mode: "live" | "prep";
}) {
  const ids = useId();
  const { creatures } = catalogue;
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<ReadonlySet<CreatureTag>>(new Set(CREATURE_TAGS));
  const [lowestChallenge, setLowest] = useState("");
  const [highestChallenge, setHighest] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [maxHp, setMaxHp] = useState("");
  const [pickedKey, setPickedKey] = useState<string>();
  const [added, setAdded] = useState<string>();

  const types = useMemo(() => creatureTypes(creatures), [creatures]);
  const found = useMemo(
    () => findCreatures(creatures, { query, tags, lowestChallenge, highestChallenge, type }),
    [creatures, query, tags, lowestChallenge, highestChallenge, type],
  );
  const shown = found.slice(0, SHOWN);
  // Searching picks the best match, so Enter adds it straight away.
  const picked = shown.find((c) => c.key === pickedKey) ?? (query.trim() ? shown[0] : undefined);
  const needsHp = picked && picked.hitDice === undefined && picked.hitPoints === undefined;

  function add(creature: CreatureOption | undefined) {
    if (!creature) return;
    const hp = maxHp.trim() === "" ? undefined : Number(maxHp);
    if (creature.hitDice === undefined && creature.hitPoints === undefined && !hp) {
      setPickedKey(creature.key);
      setAdded(`${creature.name} needs a Max HP: its statblock has none.`);
      return;
    }
    const count = Math.min(20, Math.max(1, Math.floor(Number(quantity)) || 1));
    dispatch(addMonsters(creature, count, rng, { maxHp: hp, rollInitiative: mode === "live" }));
    setAdded(`Added ${count} ${creature.name} (${tagOf(creature)}).`);
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

  function toggle(tag: CreatureTag) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    // Turning the last one off would show nothing; show everything instead.
    setTags(next.size ? next : new Set(CREATURE_TAGS));
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="@container flex flex-col gap-2">
      <h3 id={`${ids}-heading`} className={labelClass}>
        Monsters and NPCs
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="search"
          aria-label="Find a monster"
          aria-controls={`${ids}-list`}
          placeholder="Find a monster… (↑↓ to pick, Enter adds)"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPickedKey(undefined);
          }}
          onKeyDown={keys}
          className={`${inputClass} min-w-40 flex-1`}
        />
        <label className="flex items-center gap-1 text-sm">
          How many
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={`${inputClass} w-16`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {CREATURE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.has(tag)}
            onClick={() => toggle(tag)}
            className={`rounded-full border px-3 py-0.5 ${
              tags.has(tag) ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
            }`}
          >
            {tag}
          </button>
        ))}
        <span className="flex items-center gap-1">
          CR
          <ChallengeSelect
            label="Lowest challenge rating"
            value={lowestChallenge}
            onChange={setLowest}
          />
          –
          <ChallengeSelect
            label="Highest challenge rating"
            value={highestChallenge}
            onChange={setHighest}
          />
        </span>
        <select
          aria-label="Creature type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={`${inputClass} py-0.5 capitalize`}
        >
          <option value="">Any type</option>
          {types.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </select>
      </div>

      <ul
        id={`${ids}-list`}
        aria-label="Monsters found"
        className="max-h-96 overflow-y-auto rounded-md border border-line"
      >
        {shown.length === 0 && (
          <li className="p-3 text-sm text-muted">
            {creatures.length === 0 ? "No statblocks yet." : "Nothing matches."}
          </li>
        )}
        {shown.map((creature) => (
          <li
            key={creature.key}
            className={`flex items-center gap-2 border-b border-line px-2 py-1 text-sm last:border-b-0 ${
              creature === picked ? "bg-accent-surface" : ""
            }`}
          >
            <button
              type="button"
              aria-pressed={creature === picked}
              onClick={() => setPickedKey(creature.key)}
              onDoubleClick={() => add(creature)}
              className="min-w-0 flex-1 truncate text-left"
            >
              <span className="font-medium">{creature.name}</span>
              {creature.noteTitle && creature.noteTitle !== creature.name && (
                <span className="text-muted"> ({creature.noteTitle})</span>
              )}
            </button>
            <Tag creature={creature} />
            <span className="w-8 text-right text-muted tabular-nums">
              {creature.challenge ?? "–"}
            </span>
            <span className="hidden w-24 truncate text-muted capitalize @lg:block">
              {creature.type}
            </span>
            <span className="hidden w-20 truncate text-muted @lg:block">{creature.size}</span>
            <button
              type="button"
              aria-label={`Add ${creature.name} (${tagOf(creature)})`}
              title={`Add ${quantity || 1}`}
              onClick={() => add(creature)}
              className={`${buttonClass} px-2 py-0`}
            >
              +
            </button>
          </li>
        ))}
      </ul>
      {found.length > SHOWN && (
        <p className="text-xs text-muted">
          Showing {SHOWN} of {found.length}. Search or filter to find the rest.
        </p>
      )}

      {picked && (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <strong>{picked.name}</strong> <Tag creature={picked} /> · AC {picked.armorClass ?? "?"}{" "}
            · HP {picked.hitPoints ?? "?"}
            {picked.hitDice && ` (${picked.hitDice})`} · Initiative{" "}
            {picked.initiativeBonus >= 0 ? "+" : ""}
            {picked.initiativeBonus}
          </p>
          <details>
            <summary className="cursor-pointer text-link">Statblock</summary>
            <div className="mt-2">
              <StatblockPanel
                label="Statblock preview"
                catalogue={catalogue}
                creature={picked}
                hasStatblock
              />
            </div>
          </details>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-medium">
          Max HP
          <input
            type="number"
            min={1}
            value={maxHp}
            onChange={(event) => setMaxHp(event.target.value)}
            placeholder={
              picked?.hitDice
                ? `roll ${picked.hitDice}`
                : picked?.hitPoints !== undefined
                  ? String(picked.hitPoints)
                  : needsHp
                    ? "required"
                    : "roll"
            }
            className={`${inputClass} w-32`}
          />
        </label>
        <p className="flex-1 text-xs text-muted">
          {mode === "live"
            ? "Each rolls initiative and hit points."
            : "Each rolls hit points now, and initiative when the fight starts."}{" "}
          Leave Max HP blank to roll.
        </p>
      </div>
      <p role="status" className="text-sm text-muted">
        {added}
      </p>
    </section>
  );
}

function Tag({ creature }: { creature: CreatureOption }) {
  const tag = tagOf(creature);
  return (
    <span
      className={`rounded px-1.5 text-xs font-semibold ${
        tag === "Mine" ? "bg-accent text-on-accent" : "border border-line text-muted"
      }`}
    >
      {tag}
    </span>
  );
}

function ChallengeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} py-0.5`}
    >
      <option value="">any</option>
      {CHALLENGE_RATINGS.map((rating) => (
        <option key={rating} value={rating}>
          {rating}
        </option>
      ))}
    </select>
  );
}
