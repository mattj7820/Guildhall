// PROTOTYPE (removed before the PR): finding and adding SRD monsters among the vault's statblocks.
// Nothing here is saved; the "fight" is a scratch list in the page.
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { DiceRoller } from "~/components/combat/DiceRoller";
import { StatblockPanel } from "~/components/combat/StatblockPanel";
import { buttonClass, inputClass, labelClass, panelClass } from "~/components/styles";
import { parseDice, formatDice } from "~/dice/parse";
import { defaultRng } from "~/dice/rng";
import { useRollLog } from "~/dice/useRollLog";
import { newId } from "~/shared/ids";

export interface PrototypeCreature {
  key: string;
  source: Source;
  name: string;
  noteTitle?: string;
  noteUrl?: string;
  challenge?: string;
  size?: string;
  type?: string;
  armorClass?: number;
  hitPoints?: number;
  hitDice?: string;
  speed?: string;
  initiative: number;
  lore?: string;
  html: string;
}

type Source = "mine" | "2024" | "2014";
const SOURCES: Source[] = ["mine", "2024", "2014"];
const SOURCE_LABEL: Record<Source, string> = { mine: "Mine", "2024": "2024", "2014": "2014" };

interface Added {
  id: string;
  name: string;
  hp: number;
  creature: PrototypeCreature;
}

type Order = "mine-first" | "mixed";
type AddStyle = "plus" | "select";
type Width = "page" | "panel";

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** "1/4" → 0.25; unknown sorts last. */
function crValue(challenge?: string): number {
  if (!challenge) return Infinity;
  const [top, bottom] = challenge.split("/").map(Number);
  return bottom ? top / bottom : top;
}

const CR_STEPS = ["0", "1/8", "1/4", "1/2", ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

/** 0 exact, 1 prefix, 2 a word's start, 3 anywhere; undefined if it doesn't match. */
function matchRank(creature: PrototypeCreature, query: string): number | undefined {
  if (!query) return 0;
  const ranks = [creature.name, creature.noteTitle ?? ""].map((text): number | undefined => {
    const name = text.toLowerCase();
    if (name === query) return 0;
    if (name.startsWith(query)) return 1;
    if (name.split(/[\s(),-]+/).some((word) => word.startsWith(query))) return 2;
    if (name.includes(query)) return 3;
    return undefined;
  });
  const found = ranks.filter((rank): rank is number => rank !== undefined);
  return found.length ? Math.min(...found) : undefined;
}

export function SrdPrototype({ creatures }: { creatures: PrototypeCreature[] }) {
  const [order, setOrder] = useState<Order>("mine-first");
  const [addStyle, setAddStyle] = useState<AddStyle>("plus");
  const [width, setWidth] = useState<Width>("page");
  const [preferred, setPreferred] = useState<"2024" | "2014">("2024");
  const [added, setAdded] = useState<Added[]>([]);
  const [shownId, setShownId] = useState<string>();
  const [preview, setPreview] = useState<PrototypeCreature>();
  const rolls = useRollLog(defaultRng);

  function add(creature: PrototypeCreature, quantity: number, maxHp?: number) {
    const sameName = added.filter((each) => each.creature.name === creature.name).length;
    const fresh = Array.from({ length: quantity }, (_, index): Added => {
      const hp = maxHp ?? rollHp(creature);
      return {
        id: newId(),
        name: quantity + sameName > 1 ? `${creature.name} ${sameName + index + 1}` : creature.name,
        hp,
        creature,
      };
    });
    setAdded((list) => [...list, ...fresh]);
    setShownId(fresh[0].id);
    setPreview(undefined);
  }

  const shown = added.find((each) => each.id === shownId);
  const panelCreature = preview ?? shown?.creature;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">SRD monsters prototype</h1>
      <p className="mt-1 text-sm text-muted">
        Prototype: {creatures.filter((c) => c.source !== "mine").length} SRD monsters and your
        vault&rsquo;s {creatures.filter((c) => c.source === "mine").length} statblocks. Nothing is
        saved. 2024 attack bonuses aren&rsquo;t clickable yet (&ldquo;Attack Roll: +4&rdquo; is step
        2); their damage dice are.
      </p>
      <div className={`${panelClass} mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm`}>
        <Switch
          label="Order while browsing"
          value={order}
          options={[
            ["mine-first", "Mine first"],
            ["mixed", "All by name, tagged"],
          ]}
          onChange={setOrder}
        />
        <Switch
          label="Adding"
          value={addStyle}
          options={[
            ["plus", "+ on each row"],
            ["select", "Select, then Add"],
          ]}
          onChange={setAddStyle}
        />
        <Switch
          label="Width"
          value={width}
          options={[
            ["page", "Combat page"],
            ["panel", "Map side panel"],
          ]}
          onChange={setWidth}
        />
        <Switch
          label="Rules I use"
          value={preferred}
          options={[
            ["2024", "2024"],
            ["2014", "2014"],
          ]}
          onChange={setPreferred}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className={width === "panel" ? "w-[22rem]" : "min-w-[28rem] flex-1"}>
          <Picker
            creatures={creatures}
            order={order}
            addStyle={addStyle}
            narrow={width === "panel"}
            preferred={preferred}
            onAdd={add}
            onPreview={setPreview}
          />
        </div>
        <div className="flex w-[26rem] flex-col gap-4">
          <section className={panelClass} aria-label="Scratch fight">
            <h2 className="mb-2 font-serif text-xl font-bold">Scratch fight</h2>
            {added.length === 0 ? (
              <p className="text-sm text-muted">Add a monster to see it here.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {added.map((each) => (
                  <li key={each.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`${buttonClass} ${each.id === shownId && !preview ? "ring-2 ring-accent" : ""}`}
                      onClick={() => {
                        setShownId(each.id);
                        setPreview(undefined);
                      }}
                    >
                      📜
                    </button>
                    <span className="flex-1">{each.name}</span>
                    <SourceTag source={each.creature.source} />
                    <span className="text-muted">
                      AC {each.creature.armorClass ?? "?"} · HP {each.hp}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <DiceRoller rolls={rolls} />
          <StatblockPanel
            combatantName={preview ? undefined : shown?.name}
            creature={
              panelCreature && {
                key: panelCreature.key,
                ref: { entityId: panelCreature.key, name: panelCreature.name },
                name: panelCreature.name,
                noteTitle: panelCreature.noteTitle ?? "",
                noteUrl: panelCreature.noteUrl ?? "",
                initiativeBonus: panelCreature.initiative,
                html: panelCreature.html,
              }
            }
            hasStatblock
            onRoll={preview ? undefined : rolls.roll}
          />
          {panelCreature?.lore && (
            <section className={panelClass} aria-label="Lore">
              <h3 className={labelClass}>From the SRD</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{panelCreature.lore}</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Picker({
  creatures,
  order,
  addStyle,
  narrow,
  preferred,
  onAdd,
  onPreview,
}: {
  creatures: PrototypeCreature[];
  order: Order;
  addStyle: AddStyle;
  narrow: boolean;
  preferred: "2024" | "2014";
  onAdd: (creature: PrototypeCreature, quantity: number, maxHp?: number) => void;
  onPreview: (creature: PrototypeCreature | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Set<Source>>(new Set(SOURCES));
  const [crMin, setCrMin] = useState("");
  const [crMax, setCrMax] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [maxHp, setMaxHp] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>();

  const types = useMemo(
    () => [...new Set(creatures.flatMap((c) => (c.type ? [c.type] : [])))].sort(),
    [creatures],
  );

  const q = query.trim().toLowerCase();
  const results = creatures
    .flatMap((creature) => {
      if (!sources.has(creature.source)) return [];
      if (type && creature.type !== type) return [];
      const cr = crValue(creature.challenge);
      if (crMin && cr < crValue(crMin)) return [];
      if (crMax && cr > crValue(crMax)) return [];
      const rank = matchRank(creature, q);
      return rank === undefined ? [] : [{ creature, rank }];
    })
    .sort((a, b) => {
      const sourceOrder = (c: PrototypeCreature) =>
        c.source === "mine" ? 0 : c.source === preferred ? 1 : 2;
      if (q) {
        return (
          a.rank - b.rank ||
          sourceOrder(a.creature) - sourceOrder(b.creature) ||
          byName.compare(a.creature.name, b.creature.name)
        );
      }
      if (order === "mine-first") {
        const mine = (c: PrototypeCreature) => (c.source === "mine" ? 0 : 1);
        return (
          mine(a.creature) - mine(b.creature) ||
          byName.compare(a.creature.name, b.creature.name) ||
          sourceOrder(a.creature) - sourceOrder(b.creature)
        );
      }
      return (
        byName.compare(a.creature.name, b.creature.name) ||
        sourceOrder(a.creature) - sourceOrder(b.creature)
      );
    })
    .map(({ creature }) => creature);

  const selected =
    results.find((c) => c.key === selectedKey) ?? (q ? results[0] : undefined) ?? undefined;

  function addSelected(creature = selected) {
    if (!creature) return;
    const hp = maxHp.trim() ? Number(maxHp) : undefined;
    onAdd(creature, Math.max(1, quantity), hp);
  }

  function keys(event: KeyboardEvent) {
    const index = selected ? results.indexOf(selected) : -1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = results[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) setSelectedKey(next.key);
    } else if (event.key === "Enter") {
      event.preventDefault();
      addSelected();
    }
  }

  function toggleSource(source: Source) {
    setSources((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next.size ? next : new Set(SOURCES);
    });
  }

  return (
    <section className={panelClass} aria-label="Add monsters">
      <h2 className="mb-2 font-serif text-xl font-bold">Monsters and NPCs</h2>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          autoFocus
          placeholder="Find a monster… (↑↓, Enter adds)"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedKey(undefined);
          }}
          onKeyDown={keys}
          className={`${inputClass} min-w-0 flex-1`}
          aria-label="Find a monster"
        />
        <label className="flex items-center gap-1 text-sm">
          How many
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            className={`${inputClass} w-16`}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            aria-pressed={sources.has(source)}
            onClick={() => toggleSource(source)}
            className={`rounded-full border px-3 py-0.5 ${
              sources.has(source)
                ? "border-accent bg-accent text-on-accent"
                : "border-line text-muted"
            }`}
          >
            {SOURCE_LABEL[source]}
          </button>
        ))}
        <label className="flex items-center gap-1">
          CR
          <CrSelect value={crMin} onChange={setCrMin} label="Lowest challenge rating" />
          –
          <CrSelect value={crMax} onChange={setCrMax} label="Highest challenge rating" />
        </label>
        <select
          aria-label="Creature type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={`${inputClass} py-0.5`}
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
        role="listbox"
        aria-label="Monsters"
        className="mt-3 max-h-[24rem] overflow-y-auto rounded border border-line"
      >
        {results.length === 0 && <li className="p-3 text-sm text-muted">Nothing matches.</li>}
        {results.map((creature) => {
          const isSelected = creature === selected;
          return (
            <li
              key={creature.key}
              role="option"
              aria-selected={isSelected}
              onClick={() => setSelectedKey(creature.key)}
              onDoubleClick={() => addSelected(creature)}
              className={`flex cursor-pointer items-center gap-2 border-b border-line px-2 py-1 text-sm last:border-b-0 ${
                isSelected ? "bg-accent-surface" : "hover:bg-raised"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{creature.name}</span>
                {creature.noteTitle && creature.noteTitle !== creature.name && (
                  <span className="text-muted"> ({creature.noteTitle})</span>
                )}
              </span>
              <SourceTag source={creature.source} />
              <span className="w-10 text-right text-muted tabular-nums">
                {creature.challenge ?? "–"}
              </span>
              {!narrow && (
                <>
                  <span className="w-24 truncate text-muted capitalize">{creature.type}</span>
                  <span className="w-20 truncate text-muted">{creature.size}</span>
                </>
              )}
              {addStyle === "plus" && (
                <button
                  type="button"
                  aria-label={`Add ${creature.name}`}
                  className={`${buttonClass} px-2 py-0`}
                  onClick={(event) => {
                    event.stopPropagation();
                    addSelected(creature);
                  }}
                >
                  +
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <p>
            <strong>{selected.name}</strong> <SourceTag source={selected.source} /> · AC{" "}
            {selected.armorClass ?? "?"} · HP {selected.hitPoints ?? "?"}
            {selected.hitDice && ` (${selected.hitDice})`}
            {selected.speed && ` · Speed ${selected.speed}`}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className={buttonClass} onClick={() => onPreview(selected)}>
              Statblock ▸
            </button>
            <label className="flex items-center gap-1">
              Max HP
              <input
                type="number"
                min={1}
                value={maxHp}
                onChange={(event) => setMaxHp(event.target.value)}
                placeholder={selected.hitDice ? `roll ${selected.hitDice}` : "required"}
                className={`${inputClass} w-32`}
              />
            </label>
            {addStyle === "select" && (
              <button type="button" className={buttonClass} onClick={() => addSelected()}>
                Add {quantity > 1 ? `${quantity} ` : ""}
                {selected.name}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CrSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} py-0.5`}
    >
      <option value="">any</option>
      {CR_STEPS.map((step) => (
        <option key={step} value={step}>
          {step}
        </option>
      ))}
    </select>
  );
}

function SourceTag({ source }: { source: Source }) {
  return (
    <span
      className={`rounded px-1.5 text-xs font-semibold ${
        source === "mine" ? "bg-accent text-on-accent" : "border border-line text-muted"
      }`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

function Switch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className={labelClass}>{label}</span>
      {options.map(([option, text]) => (
        <label key={option} className="flex items-center gap-1">
          <input type="radio" checked={value === option} onChange={() => onChange(option)} />
          {text}
        </label>
      ))}
    </fieldset>
  );
}

function rollHp(creature: PrototypeCreature): number {
  const parsed = creature.hitDice ? parseDice(creature.hitDice) : undefined;
  if (!parsed?.ok) return creature.hitPoints ?? 1;
  // A rough roll for the prototype: the real tracker rolls through addMonsters.
  const text = formatDice(parsed.expression);
  let total = 0;
  for (const [, count, sides] of text.matchAll(/(\d+)d(\d+)/g)) {
    for (let i = 0; i < Number(count); i++) total += defaultRng(Number(sides));
  }
  const modifier = /([+−-])\s*(\d+)$/.exec(text);
  if (modifier) total += (modifier[1] === "+" ? 1 : -1) * Number(modifier[2]);
  return Math.max(1, total);
}
