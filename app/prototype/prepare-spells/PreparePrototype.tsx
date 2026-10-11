// PROTOTYPE (removed before the PR): preparing spells, with pretend data and nothing saved.
import { useState } from "react";
import { FilterChips } from "~/components/characters/FilterChips";
import { Pips } from "~/components/characters/Pips";
import { buttonClass, inputClass, labelClass, panelClass } from "~/components/styles";

type Level = 0 | 1 | 2;

interface ProtoSpell {
  id: string;
  name: string;
  level: Level;
  meta: string;
  concentration?: boolean;
  ritual?: boolean;
  /** A feature's free use (a feat's once a day): always ready. */
  free?: string;
  roll?: string;
  save?: string;
  attack?: boolean;
  prepared: boolean;
}

type Unprepared = "hidden" | "greyed";
type Toggle = "checkbox" | "button";
type Mode = "everyday" | "prepare";
type Filter = "all" | Level;

const SPELL_NAMES: [string, string, Partial<ProtoSpell>?][] = [
  ["Cure Wounds", "1 action · Touch", { roll: "1d8+3" }],
  ["Detect Magic", "1 action · Self", { concentration: true, ritual: true }],
  ["Disguise Self", "1 action · Self"],
  ["Expeditious Retreat", "1 bonus action · Self", { concentration: true }],
  ["Faerie Fire", "1 action · 60 ft.", { concentration: true, save: "DEX 12" }],
  ["False Life", "1 action · Self", { roll: "1d4+4" }],
  ["Feather Fall", "1 reaction · 60 ft."],
  ["Grease", "1 action · 60 ft.", { save: "DEX 12" }],
  ["Identify", "1 minute · Touch", { ritual: true }],
  ["Jump", "1 bonus action · Touch"],
  ["Longstrider", "1 action · Touch"],
  ["Sanctuary", "1 bonus action · 30 ft.", { save: "WIS 12" }],
  ["Alarm", "1 minute · 30 ft.", { ritual: true }],
  ["Fog Cloud", "1 action · 120 ft.", { concentration: true }],
  ["Heroism", "1 action · Touch", { concentration: true }],
  ["Shield", "1 reaction · Self"],
  ["Bless", "1 action · 30 ft.", { concentration: true }],
  ["Thunderwave", "1 action · Self", { save: "CON 12", roll: "2d8" }],
];

const PREPARED = new Set(["Cure Wounds", "Faerie Fire", "Grease"]);

function startingSpells(): ProtoSpell[] {
  return [
    {
      id: "c1",
      name: "Fire Bolt",
      level: 0,
      meta: "1 action · 120 ft.",
      attack: true,
      roll: "1d10",
      prepared: true,
    },
    { id: "c2", name: "Mending", level: 0, meta: "1 minute · Touch", prepared: true },
    ...SPELL_NAMES.map(([name, meta, extra], index): ProtoSpell => ({
      id: `s${index}`,
      name,
      level: 1,
      meta,
      prepared: PREPARED.has(name),
      ...extra,
    })),
    {
      id: "free",
      name: "Sleep",
      level: 1,
      meta: "1 action · 60 ft.",
      roll: "5d8",
      free: "Magic Initiate",
      prepared: true,
    },
  ];
}

const alwaysReady = (spell: ProtoSpell) => spell.level === 0 || spell.free !== undefined;
const isReady = (spell: ProtoSpell) => alwaysReady(spell) || spell.prepared;
const counts = (spell: ProtoSpell) => !alwaysReady(spell) && spell.prepared;

export function PreparePrototype() {
  const [spells, setSpells] = useState(startingSpells);
  const [toPrepare, setToPrepare] = useState<number | undefined>(3);
  const [unprepared, setUnprepared] = useState<Unprepared>("hidden");
  const [toggle, setToggle] = useState<Toggle>("checkbox");
  const [sheetMode, setSheetMode] = useState<Mode>("everyday");
  const [panelMode, setPanelMode] = useState<Mode>("everyday");
  const [slots, setSlots] = useState({ max: 2, used: 1 });
  const [toast, setToast] = useState<string>();

  const shared = {
    spells,
    toPrepare,
    unprepared,
    toggle,
    slots,
    onSlots: (by: number) =>
      setSlots((each) => ({ ...each, used: Math.max(0, Math.min(each.max, each.used + by)) })),
    onPrepare: (id: string, prepared: boolean) =>
      setSpells((list) => list.map((spell) => (spell.id === id ? { ...spell, prepared } : spell))),
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-title">Preparing spells: prototype</h1>
        <p className="text-sm text-muted">
          Pretend data, nothing saved. The full sheet's Spells tab on the left, the compact sheet
          beside the map on the right (its real width); they share one character.
        </p>
      </header>

      <section aria-label="Prototype switches" className={`${panelClass} flex flex-wrap gap-6`}>
        <Switch<Unprepared>
          label="Unprepared spells, day to day"
          value={unprepared}
          onChange={setUnprepared}
          options={[
            ["hidden", "Hidden, with a line"],
            ["greyed", "Greyed out"],
          ]}
        />
        <Switch<Toggle>
          label="Preparing a spell"
          value={toggle}
          onChange={setToggle}
          options={[
            ["checkbox", "Checkboxes"],
            ["button", "Prepare buttons"],
          ]}
        />
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Spells to prepare</span>
          <input
            type="number"
            min={0}
            className={`${inputClass} w-24`}
            value={toPrepare ?? ""}
            placeholder="None"
            onChange={(event) =>
              setToPrepare(event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Rests</span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setSlots((each) => ({ ...each, used: 0 }));
              setToast("Long rest: all hit points and spell slots back.");
            }}
          >
            Long rest
          </button>
        </div>
      </section>

      {toast && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 self-start rounded-md border border-line bg-raised px-3 py-2 text-sm shadow"
        >
          <span>{toast}</span>
          {toPrepare !== undefined && (
            <button
              type="button"
              className="font-semibold text-link hover:underline"
              onClick={() => {
                setSheetMode("prepare");
                setToast(undefined);
              }}
            >
              Change prepared spells
            </button>
          )}
          <button
            type="button"
            className="text-muted hover:text-ink"
            aria-label="Dismiss"
            onClick={() => setToast(undefined)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <section aria-label="Full sheet" className={`${panelClass} w-full min-w-0 flex-1`}>
          <h2 className={`${labelClass} mb-3`}>Full sheet · Spells tab</h2>
          <SpellsView {...shared} mode={sheetMode} setMode={setSheetMode} />
        </section>
        <section
          aria-label="Beside the map"
          className={`${panelClass} w-full shrink-0 lg:w-[27rem]`}
        >
          <h2 className={`${labelClass} mb-3`}>Beside the map · Sheet</h2>
          <SpellsView {...shared} compact mode={panelMode} setMode={setPanelMode} />
        </section>
      </div>
    </main>
  );
}

function SpellsView({
  spells,
  toPrepare,
  unprepared,
  toggle,
  slots,
  onSlots,
  onPrepare,
  compact = false,
  mode,
  setMode,
}: {
  spells: ProtoSpell[];
  toPrepare?: number;
  unprepared: Unprepared;
  toggle: Toggle;
  slots: { max: number; used: number };
  onSlots: (by: number) => void;
  onPrepare: (id: string, prepared: boolean) => void;
  compact?: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const preparing = mode === "prepare";
  const preparable = spells.filter((spell) => !alwaysReady(spell));
  const preparedCount = spells.filter(counts).length;
  const notPrepared = preparable.length - preparedCount;
  const listed = spells.filter((spell) => preparing || isReady(spell) || unprepared === "greyed");
  const shown = listed.filter((spell) => filter === "all" || spell.level === filter);
  const levels = ([0, 1, 2] as const).filter((level) => listed.some((s) => s.level === level));

  return (
    <div className="flex flex-col gap-3">
      {preparing ? (
        <PrepareHeader
          count={preparedCount}
          toPrepare={toPrepare}
          compact={compact}
          onDone={() => setMode("everyday")}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {compact ? (
            <span className="text-muted">INT · DC 12 · +4</span>
          ) : (
            <>
              <span>
                Spellcasting <strong>INT</strong>
              </span>
              <span>
                Save DC <strong>12</strong>
              </span>
              <span>
                Spell attack <strong>+4</strong>
              </span>
              {toPrepare !== undefined && (
                <span>
                  Prepares <strong>{toPrepare}</strong>
                </span>
              )}
            </>
          )}
          {preparable.length > 0 && (
            <button
              type="button"
              className={`${buttonClass} ml-auto`}
              onClick={() => setMode("prepare")}
            >
              {compact ? "Prepare" : "Prepare spells"}
            </button>
          )}
        </div>
      )}
      <FilterChips<Filter>
        label="Show spells"
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "All"],
          ...levels.map((level) => [level, level === 0 ? "Cantrips" : "1st"] as const),
        ]}
      />
      {levels
        .filter((level) => shown.some((spell) => spell.level === level))
        .map((level) => (
          <section key={level} aria-label={level === 0 ? "Cantrips" : "1st level"}>
            <h3 className="flex items-center gap-3 border-b border-line pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
              {level === 0 ? "Cantrips" : "1st level"}
              {level === 1 && !preparing && (
                <Pips label="1st-level slot" counter={slots} size="sm" onCount={onSlots} />
              )}
              {level === 0 && preparing && (
                <span className="ml-auto font-normal tracking-normal normal-case">
                  Always ready
                </span>
              )}
            </h3>
            <ul>
              {shown
                .filter((spell) => spell.level === level)
                .map((spell) =>
                  preparing ? (
                    <PrepareRow
                      key={spell.id}
                      spell={spell}
                      toggle={toggle}
                      compact={compact}
                      onPrepare={onPrepare}
                    />
                  ) : (
                    <EverydayRow key={spell.id} spell={spell} compact={compact} />
                  ),
                )}
            </ul>
          </section>
        ))}
      {!preparing && unprepared === "hidden" && notPrepared > 0 && (
        <p className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm text-muted">
          {notPrepared} {notPrepared === 1 ? "spell" : "spells"} not prepared
          <span aria-hidden>·</span>
          <button
            type="button"
            className="font-semibold text-link hover:underline"
            onClick={() => setMode("prepare")}
          >
            Prepare spells
          </button>
        </p>
      )}
    </div>
  );
}

function PrepareHeader({
  count,
  toPrepare,
  compact,
  onDone,
}: {
  count: number;
  toPrepare?: number;
  compact: boolean;
  onDone: () => void;
}) {
  const over = toPrepare !== undefined && count > toPrepare ? count - toPrepare : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-semibold text-title">Prepare spells</h3>
        <span
          role="status"
          className={`ml-auto text-sm font-semibold tabular-nums ${over ? "text-warn" : "text-ink"}`}
        >
          {toPrepare === undefined ? `${count} prepared` : `${count} / ${toPrepare} prepared`}
          {over > 0 && (
            <span className="font-normal">
              {" "}
              · {compact ? `${over} over` : `${over} more than you prepare`}
            </span>
          )}
        </span>
        <button type="button" className={buttonClass} onClick={onDone}>
          Done
        </button>
      </div>
      {!compact && (
        <p className="text-xs text-muted">
          Choose what&apos;s ready today. Cantrips and free spells are always ready and don&apos;t
          count.
        </p>
      )}
    </div>
  );
}

function PrepareRow({
  spell,
  toggle,
  compact,
  onPrepare,
}: {
  spell: ProtoSpell;
  toggle: Toggle;
  compact: boolean;
  onPrepare: (id: string, prepared: boolean) => void;
}) {
  const always = alwaysReady(spell);
  const name = (
    <span className="min-w-0">
      <span className="font-medium">{spell.name}</span>
      {spell.concentration && <Badge title="Concentration">C</Badge>}
      {spell.ritual && <Badge title="Ritual">R</Badge>}
      {!compact && <span className="ml-2 text-xs text-muted">{spell.meta}</span>}
    </span>
  );
  return (
    <li className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
      {always ? (
        <>
          {toggle === "checkbox" && <span className="w-4" aria-hidden />}
          <span className="mr-auto">{name}</span>
          <span className="text-xs text-muted">
            {spell.free ? `Free (${spell.free}) · Always ready` : ""}
          </span>
        </>
      ) : toggle === "checkbox" ? (
        <label className="flex flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={spell.prepared}
            onChange={(event) => onPrepare(spell.id, event.target.checked)}
          />
          {name}
        </label>
      ) : (
        <>
          <span className={`mr-auto ${spell.prepared ? "" : "text-muted"}`}>{name}</span>
          <button
            type="button"
            aria-pressed={spell.prepared}
            onClick={() => onPrepare(spell.id, !spell.prepared)}
            className={`w-24 rounded-md px-2 py-0.5 text-sm font-semibold ${
              spell.prepared
                ? "bg-accent text-on-accent hover:bg-accent-strong"
                : "border border-line text-muted hover:bg-raised"
            }`}
          >
            {spell.prepared ? "Prepared" : "Prepare"}
          </button>
        </>
      )}
    </li>
  );
}

function EverydayRow({ spell, compact }: { spell: ProtoSpell; compact: boolean }) {
  const ready = isReady(spell);
  return (
    <li
      className={`flex flex-wrap items-center gap-2 border-b border-line py-1.5 last:border-0 ${
        ready ? "" : "opacity-50"
      }`}
    >
      <span className="mr-auto min-w-0">
        <span className="font-medium">{spell.name}</span>
        {spell.concentration && <Badge title="Concentration">C</Badge>}
        {spell.ritual && <Badge title="Ritual">R</Badge>}
        {spell.free && <span className="ml-2 text-xs text-muted">Free ({spell.free})</span>}
        {!compact && <span className="ml-2 text-xs text-muted">{spell.meta}</span>}
      </span>
      {spell.attack && <Chip>+4</Chip>}
      {spell.save && <span className="text-xs font-semibold text-muted">{spell.save}</span>}
      {spell.roll && <Chip>{spell.roll}</Chip>}
      {spell.level > 0 &&
        (ready ? (
          <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent">
            Cast ▾
          </span>
        ) : (
          <span className="text-xs text-muted">Not prepared</span>
        ))}
    </li>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded border border-line-strong px-1.5 text-sm font-semibold">
      {children}
    </span>
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

function Switch<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <FilterChips<T> label={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}
