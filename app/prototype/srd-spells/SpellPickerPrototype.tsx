// PROTOTYPE (removed before the PR): finding and adding spells, with switches to compare choices.
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { ABILITY_NAMES, type Ability } from "~/characters/abilities";
import { ORDINALS } from "~/characters/describe";
import { buttonClass, inputClass, labelClass, panelClass } from "~/components/styles";
import type { SpellShape } from "~/maps/grid/shapes";

type Tag = "Mine" | "2024" | "2014";
const TAGS: Tag[] = ["Mine", "2024", "2014"];

export interface PrototypeSpell {
  key: string;
  tag: Tag;
  name: string;
  /** Undefined for a vault note whose frontmatter has no level. */
  level: number | undefined;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack: boolean;
  save?: Ability;
  roll?: string;
  effect?: string;
  area?: { shape: SpellShape; feet: number };
  html: string;
  source?: string;
  noteUrl?: string;
  hiddenFromPlayers?: boolean;
}

/** What + would put on the sheet: an ordinary spell, linked to where it came from. */
interface SheetSpell extends Omit<PrototypeSpell, "level" | "html" | "classes"> {
  id: string;
  level: number;
  from: string;
  prepared: boolean;
}

const SHOWN = 100;
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const TAG_ORDER: Record<Tag, number> = { Mine: 0, "2024": 1, "2014": 2 };

const levelName = (level: number | undefined) =>
  level === undefined ? "–" : level === 0 ? "Cantrip" : ORDINALS[level];

function matchRank(name: string, query: string): number | undefined {
  if (!query) return 0;
  const text = name.toLowerCase();
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (text.split(/[\s(),/'-]+/).some((word) => word.startsWith(query))) return 2;
  return text.includes(query) ? 3 : undefined;
}

export function SpellPickerPrototype({ spells }: { spells: PrototypeSpell[] }) {
  const [defaults, setDefaults] = useState<"2024+mine" | "all">("2024+mine");
  const [order, setOrder] = useState<"name" | "level">("name");
  const [width, setWidth] = useState<"sheet" | "panel">("sheet");
  const [asPlayer, setAsPlayer] = useState(false);
  const [toPrepare, setToPrepare] = useState("3");
  const [sheet, setSheet] = useState<SheetSpell[]>([]);
  const [picking, setPicking] = useState(true);
  const [toast, setToast] = useState<{ text: string; id: string }>();

  const visible = asPlayer ? spells.filter((spell) => !spell.hiddenFromPlayers) : spells;
  const most = toPrepare.trim() === "" ? undefined : Number(toPrepare);
  const preparedCount = sheet.filter((s) => s.level > 0 && s.prepared).length;

  function add(spell: PrototypeSpell) {
    const level = spell.level ?? 0;
    const prepared = most === undefined || preparedCount < most;
    const { html: _html, classes: _classes, ...fields } = spell;
    const added: SheetSpell = {
      ...fields,
      id: crypto.randomUUID(),
      level,
      from: spell.source ?? (spell.noteUrl ? "Vault note" : "Typed"),
      prepared,
    };
    setSheet((current) => [...current, added]);
    const state =
      level === 0
        ? "a cantrip, always ready"
        : prepared
          ? `prepared${most === undefined ? "" : ` (${preparedCount + 1} of ${most})`}`
          : `not prepared (${preparedCount} of ${most} already)`;
    setToast({ text: `Added ${spell.name} (${spell.tag}), ${state}.`, id: added.id });
  }

  function typeOne() {
    add({
      key: "typed",
      tag: "Mine",
      name: "New spell",
      level: 0,
      classes: [],
      castingTime: "1 action",
      range: "",
      components: "",
      duration: "",
      concentration: false,
      ritual: false,
      attack: false,
      html: "",
      source: "Typed in",
    });
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header>
        <h1 className="font-serif text-2xl font-bold">Spell picker prototype</h1>
        <p className="text-sm text-muted">
          Nothing is saved. {spells.filter((s) => s.tag !== "Mine").length} real SRD spells from
          both versions (roughly converted), and the fixture vault&rsquo;s spell notes as
          &ldquo;Mine&rdquo;.
        </p>
      </header>

      <fieldset className={`${panelClass} flex flex-wrap items-center gap-x-6 gap-y-2 text-sm`}>
        <legend className={labelClass}>Try</legend>
        <Switch
          label="Chips start"
          value={defaults}
          onChange={setDefaults}
          options={[
            ["2024+mine", "2024 + Mine"],
            ["all", "All three"],
          ]}
        />
        <Switch
          label="Browse"
          value={order}
          onChange={setOrder}
          options={[
            ["name", "By name"],
            ["level", "By level"],
          ]}
        />
        <Switch
          label="Width"
          value={width}
          onChange={setWidth}
          options={[
            ["sheet", "Sheet"],
            ["panel", "Beside the map"],
          ]}
        />
        <Switch
          label="Viewer"
          value={asPlayer ? "player" : "dm"}
          onChange={(value) => setAsPlayer(value === "player")}
          options={[
            ["dm", "DM"],
            ["player", "Player"],
          ]}
        />
        <label className="flex items-center gap-1">
          Spells to prepare
          <input
            type="number"
            min={0}
            value={toPrepare}
            onChange={(event) => setToPrepare(event.target.value)}
            placeholder="none"
            className={`${inputClass} w-16`}
          />
        </label>
      </fieldset>

      <div className={width === "panel" ? "w-[22rem] self-start" : ""}>
        <section className={`${panelClass} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-serif text-xl font-bold">Spells</h2>
            {!picking && (
              <button type="button" className={buttonClass} onClick={() => setPicking(true)}>
                {width === "panel" ? "+ Add" : "Add spells"}
              </button>
            )}
          </div>
          {picking && (
            <Picker
              // Remounts with the switches, so their starting chips show.
              key={`${defaults}-${asPlayer}`}
              spells={visible}
              onSheet={new Set(sheet.map((s) => s.key))}
              defaults={defaults}
              order={order}
              compact={width === "panel"}
              onAdd={add}
              onType={typeOne}
              onDone={() => setPicking(false)}
            />
          )}
          {toast && (
            <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-info">
              {toast.text}
              <button
                type="button"
                className="font-semibold text-link hover:underline"
                onClick={() => {
                  setSheet((current) => current.filter((s) => s.id !== toast.id));
                  setToast(undefined);
                }}
              >
                Undo
              </button>
            </p>
          )}
          <SheetList spells={sheet} compact={width === "panel"} />
        </section>
      </div>
    </main>
  );
}

function Picker({
  spells,
  onSheet,
  defaults,
  order,
  compact,
  onAdd,
  onType,
  onDone,
}: {
  spells: PrototypeSpell[];
  onSheet: Set<string>;
  defaults: "2024+mine" | "all";
  order: "name" | "level";
  compact: boolean;
  onAdd: (spell: PrototypeSpell) => void;
  onType: () => void;
  onDone: () => void;
}) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<ReadonlySet<Tag>>(
    new Set(defaults === "all" ? TAGS : ["Mine", "2024"]),
  );
  const [level, setLevel] = useState<number | "any">("any");
  const [klass, setKlass] = useState("");
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [pickedKey, setPickedKey] = useState<string>();
  const [openKey, setOpenKey] = useState<string>();

  const classes = useMemo(
    () => [...new Set(spells.flatMap((s) => s.classes))].sort(byName.compare),
    [spells],
  );
  const q = query.trim().toLowerCase();
  const found = spells
    .flatMap((spell) => {
      if (!tags.has(spell.tag)) return [];
      if (level !== "any" && spell.level !== level) return [];
      if (klass && !spell.classes.includes(klass)) return [];
      if (concentration && !spell.concentration) return [];
      if (ritual && !spell.ritual) return [];
      const rank = matchRank(spell.name, q);
      return rank === undefined ? [] : [{ spell, rank }];
    })
    .sort((a, b) => {
      const name = byName.compare(a.spell.name, b.spell.name);
      const tag = TAG_ORDER[a.spell.tag] - TAG_ORDER[b.spell.tag];
      const lvl = (a.spell.level ?? -1) - (b.spell.level ?? -1);
      if (q) return a.rank - b.rank || tag || name;
      return order === "level" ? lvl || name || tag : name || tag;
    })
    .map(({ spell }) => spell);
  const shown = found.slice(0, SHOWN);
  const picked = shown.find((s) => s.key === pickedKey) ?? (q ? shown[0] : undefined);

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (picked) onAdd(picked);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = picked ? shown.indexOf(picked) : -1;
    const next = shown[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) setPickedKey(next.key);
  }

  function toggle(tag: Tag) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setTags(next.size ? next : new Set(TAGS));
  }

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-0.5 ${on ? "border-accent bg-accent text-on-accent" : "border-line text-muted"}`;

  return (
    <section
      aria-labelledby={`${ids}-heading`}
      className="flex flex-col gap-2 rounded-md border border-line p-3"
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
        placeholder="Find a spell… (↑↓ to pick, Enter adds)"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPickedKey(undefined);
        }}
        onKeyDown={keys}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {TAGS.map((tag) => (
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
              setLevel(event.target.value === "any" ? "any" : Number(event.target.value))
            }
            className={`${inputClass} py-0.5`}
          >
            <option value="any">Any level</option>
            {Array.from({ length: 10 }, (_, n) => (
              <option key={n} value={n}>
                {levelName(n)}
              </option>
            ))}
          </select>
        ) : (
          <>
            <span className="text-muted">Level</span>
            {(["any", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((each) => (
              <button
                key={each}
                type="button"
                aria-pressed={level === each}
                onClick={() => setLevel(each)}
                className={chip(level === each)}
              >
                {each === "any" ? "Any" : each === 0 ? "Cantrip" : each}
              </button>
            ))}
          </>
        )}
        <select
          aria-label="Class"
          value={klass}
          onChange={(event) => setKlass(event.target.value)}
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
        aria-label="Spells found"
        className="max-h-[28rem] overflow-y-auto rounded-md border border-line"
      >
        {shown.length === 0 && <li className="p-3 text-sm text-muted">Nothing matches.</li>}
        {shown.map((spell, index) => {
          const heading =
            !q && order === "level" && (index === 0 || spell.level !== shown[index - 1].level) ? (
              <li
                key={`level-${spell.level}`}
                className="sticky top-0 bg-raised px-2 py-0.5 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {spell.level === undefined ? "No level given" : levelName(spell.level)}
              </li>
            ) : null;
          const open = openKey === spell.key;
          return [
            heading,
            <li
              key={spell.key}
              className={`border-b border-line px-2 py-1 text-sm last:border-b-0 ${
                spell === picked ? "bg-accent-surface" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenKey(open ? undefined : spell.key);
                    setPickedKey(spell.key);
                  }}
                  className={`min-w-0 flex-1 text-left ${compact ? "" : "truncate"}`}
                >
                  <span aria-hidden className="mr-1 text-faint">
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="font-medium">{spell.name}</span>
                  {spell.concentration && <Badge title="Concentration">C</Badge>}
                  {spell.ritual && <Badge title="Ritual">R</Badge>}
                </button>
                {!(compact && order === "level" && !q) && (
                  <span className={`${compact ? "w-6" : "w-14"} text-right text-xs text-muted`}>
                    {compact ? (spell.level ?? "–") : levelName(spell.level)}
                  </span>
                )}
                {!compact && (
                  <>
                    <span className="w-24 truncate text-xs text-muted">{spell.castingTime}</span>
                    <span className="w-20 truncate text-xs text-muted">{spell.range}</span>
                    <span className="w-10 text-xs font-semibold text-muted">
                      {spell.save ? spell.save.toUpperCase() : spell.attack ? "atk" : ""}
                    </span>
                  </>
                )}
                <TagBadge spell={spell} />
                <span className="w-4 text-center text-good" title="On the sheet">
                  {onSheet.has(spell.key) ? "✓" : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Add ${spell.name} (${spell.tag})`}
                  onClick={() => onAdd(spell)}
                  className={`${buttonClass} px-2 py-0`}
                >
                  +
                </button>
              </div>
              {open && <SpellText spell={spell} />}
            </li>,
          ];
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {found.length > SHOWN
          ? `Showing ${SHOWN} of ${found.length}. Search or filter to find the rest.`
          : `${found.length} found.`}
        <span className="ml-auto">
          Not here?{" "}
          <button
            type="button"
            className="font-semibold text-link hover:underline"
            onClick={onType}
          >
            Type one in
          </button>
        </span>
      </p>
    </section>
  );
}

function SpellText({ spell }: { spell: PrototypeSpell }) {
  const facts = [
    spell.castingTime,
    spell.range,
    spell.components,
    spell.duration,
    spell.save && `${ABILITY_NAMES[spell.save]} save`,
    spell.attack && "Spell attack",
    spell.roll && `${spell.roll}${spell.effect ? ` ${spell.effect}` : ""}`,
    spell.area && `${spell.area.feet} ft. ${spell.area.shape}`,
  ].filter(Boolean);
  return (
    <div className="mt-1 mb-1 ml-4 space-y-1">
      {facts.length > 0 && <p className="text-xs text-muted">{facts.join(" · ")}</p>}
      {spell.html ? (
        <div
          className="prose prose-theme prose-sm max-w-none [&>h1:first-child]:hidden"
          dangerouslySetInnerHTML={{ __html: spell.html }}
        />
      ) : (
        <p className="text-xs text-muted">No text.</p>
      )}
      <p className="text-xs text-faint">
        {spell.source ?? (spell.hiddenFromPlayers ? "Your vault · DM only" : "Your vault")}
      </p>
    </div>
  );
}

function SheetList({ spells, compact }: { spells: SheetSpell[]; compact: boolean }) {
  const [open, setOpen] = useState<string>();
  if (spells.length === 0) {
    return <p className="text-sm text-muted">The sheet&rsquo;s spells will show here.</p>;
  }
  const levels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-2">
      <p className={labelClass}>On the sheet (what + filled in)</p>
      {levels.map((level) => (
        <section key={level}>
          <h3 className="border-b border-line pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {level === 0 ? "Cantrips" : `${ORDINALS[level]} level`}
          </h3>
          <ul>
            {spells
              .filter((s) => s.level === level)
              .map((spell) => {
                const meta = [spell.castingTime, spell.range, spell.components, spell.duration]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={spell.id} className="border-b border-line py-1.5 text-sm last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={open === spell.id}
                        onClick={() => setOpen(open === spell.id ? undefined : spell.id)}
                        className="mr-auto min-w-0 text-left"
                      >
                        <span className="font-medium">{spell.name}</span>
                        {spell.concentration && <Badge title="Concentration">C</Badge>}
                        {spell.ritual && <Badge title="Ritual">R</Badge>}
                        {!compact && meta && (
                          <span className="ml-2 text-xs text-muted">{meta}</span>
                        )}
                      </button>
                      {spell.attack && <Chip>+5</Chip>}
                      {spell.save && (
                        <span className="text-xs font-semibold text-muted">
                          {spell.save.toUpperCase()} 13
                        </span>
                      )}
                      {spell.roll && (
                        <Chip>
                          {spell.roll}
                          {!compact && spell.effect && (
                            <span className="ml-1 text-xs text-muted">{spell.effect}</span>
                          )}
                        </Chip>
                      )}
                      {spell.level > 0 && (
                        <span className="text-xs text-muted">
                          {spell.prepared ? "prepared" : "not prepared"}
                        </span>
                      )}
                    </div>
                    {open === spell.id && (
                      <div className="mt-1 space-y-1 pl-2 text-xs text-muted">
                        {compact && meta && <p>{meta}</p>}
                        {spell.area && (
                          <p>
                            Area: {spell.area.feet} ft. {spell.area.shape}
                          </p>
                        )}
                        <p>
                          Linked to: {spell.from}
                          {spell.from.startsWith("SRD") &&
                            " (its text is shown from the data here, as a linked note's is)"}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
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
  options: [T, string][];
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted">{label}</span>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded border px-2 py-0.5 ${value === key ? "border-accent bg-accent text-on-accent" : "border-line"}`}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

function TagBadge({ spell }: { spell: PrototypeSpell }) {
  return (
    <span
      className={`rounded px-1.5 text-xs font-semibold ${
        spell.tag === "Mine" ? "bg-accent text-on-accent" : "border border-line text-muted"
      }`}
      title={spell.hiddenFromPlayers ? "DM only" : undefined}
    >
      {spell.tag}
      {spell.hiddenFromPlayers && " · DM"}
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 text-xs font-semibold tabular-nums">
      {children}
    </span>
  );
}
