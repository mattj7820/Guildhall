// PROTOTYPE (removed before the PR): the pieces of tracking on a sheet, in a wide and a compact
// form, over the pretend state in `model.ts`. The real ones will dispatch actions instead.
import { createContext, useContext, useState, type ReactNode } from "react";
import { ABILITY_NAMES, signed } from "~/characters/abilities";
import { parseDice } from "~/dice/parse";
import { roll } from "~/dice/roll";
import { defaultRng } from "~/dice/rng";
import type { RollLogControls } from "~/dice/useRollLog";
import { buttonClass, inputClass, labelClass, primaryButtonClass } from "~/components/styles";
import {
  ACTIVATION_LABELS,
  ACTIVATIONS,
  hitDieHealing,
  SOURCE_LABELS,
  SOURCES,
  type Activation,
  type Feature,
  type Source,
  longRestSummary,
  ORDINALS,
  protoActions,
  type Counter,
  type CounterRef,
  type ProtoSheet,
  type Reset,
  type Spell,
} from "./model";

/* Pips: lit while available ("left"), or boxes ticked as they're used ("used"). */

export type PipStyle = "left" | "used";
export const PipStyleContext = createContext<PipStyle>("left");

/** More than this many become a number with − and +. */
const MAX_PIPS = 10;

export function Pips({
  label,
  counter,
  refTo,
  size = "md",
}: {
  label: string;
  counter: Counter;
  refTo: CounterRef;
  size?: "sm" | "md";
}) {
  const style = useContext(PipStyleContext);
  const left = counter.max - counter.used;
  const summary = `${label}: ${left} of ${counter.max} left`;
  if (counter.max === 0) return null;

  if (counter.max > MAX_PIPS) {
    return (
      <span role="group" aria-label={summary} className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={`Use one ${label}`}
          disabled={left === 0}
          onClick={() => protoActions.count(refTo, 1)}
          className="rounded border border-stone-300 px-1.5 text-sm leading-5 disabled:opacity-40 dark:border-stone-700"
        >
          −
        </button>
        <span className="min-w-[3.5ch] text-center text-sm font-semibold tabular-nums">
          {left}/{counter.max}
        </span>
        <button
          type="button"
          aria-label={`Regain one ${label}`}
          disabled={counter.used === 0}
          onClick={() => protoActions.count(refTo, -1)}
          className="rounded border border-stone-300 px-1.5 text-sm leading-5 disabled:opacity-40 dark:border-stone-700"
        >
          +
        </button>
      </span>
    );
  }

  const box = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  return (
    <span role="group" aria-label={summary} className="inline-flex items-center gap-1">
      {Array.from({ length: counter.max }, (_, index) => {
        // "left": the first `left` pips are lit. "used": the first `used` boxes are ticked.
        const spent = style === "left" ? index >= left : index < counter.used;
        return (
          <button
            key={index}
            type="button"
            aria-label={spent ? `Regain one ${label}` : `Use one ${label}`}
            title={spent ? "Spent: click to get it back" : "Click to use"}
            onClick={() => protoActions.count(refTo, spent ? -1 : 1)}
            className={`${box} inline-flex items-center justify-center transition ${
              style === "left"
                ? `rotate-45 rounded-[3px] border-2 ${
                    spent
                      ? "border-stone-300 bg-transparent dark:border-stone-600"
                      : "border-amber-600 bg-amber-400 shadow-[0_0_6px] shadow-amber-400/60 dark:border-amber-400 dark:bg-amber-500"
                  }`
                : `rounded-sm border-2 border-stone-500 text-[10px] leading-none font-bold ${
                    spent ? "bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900" : ""
                  }`
            }`}
          >
            {style === "used" && spent ? "✓" : ""}
          </button>
        );
      })}
    </span>
  );
}

const RESET_LABELS: Record<Reset, { short: string; long: string }> = {
  short: { short: "SR", long: "Short rest" },
  long: { short: "LR", long: "Long rest" },
  manual: { short: "—", long: "By hand" },
};

function ResetBadge({ reset }: { reset: Reset }) {
  if (reset === "manual") return null;
  return (
    <abbr
      title={`Resets on a ${RESET_LABELS[reset].long.toLowerCase()}`}
      className="rounded bg-stone-100 px-1 text-[10px] font-semibold text-stone-500 no-underline dark:bg-stone-800"
    >
      {RESET_LABELS[reset].short}
    </abbr>
  );
}

/* Trackers: slots, uses, hit dice, concentration, rests. */

export function Trackers({ sheet, compact = false }: { sheet: ProtoSheet; compact?: boolean }) {
  const slotLevels = sheet.slots
    .map((slot, index) => ({ slot, level: index + 1 }))
    .filter(({ slot }) => slot.max > 0);
  const size = compact ? "sm" : "md";
  return (
    <section
      aria-label="Trackers"
      className={
        compact
          ? "flex flex-col gap-2"
          : "rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
      }
    >
      <div
        className={`flex flex-wrap items-center ${compact ? "gap-x-3 gap-y-2" : "gap-x-6 gap-y-3"}`}
      >
        {slotLevels.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={labelClass}>Slots</span>
            {slotLevels.map(({ slot, level }) => (
              <span key={level} className="inline-flex items-center gap-1.5">
                <span className="text-xs text-stone-500">{ORDINALS[level]}</span>
                <Pips
                  label={`${ORDINALS[level]}-level slot`}
                  counter={slot}
                  refTo={{ slot: level }}
                  size={size}
                />
              </span>
            ))}
          </div>
        )}
        {!compact &&
          sheet.uses.map((use) => (
            <span key={use.id} className="inline-flex items-center gap-1.5">
              <span className={compact ? "text-xs" : "text-sm"}>{use.name}</span>
              <Pips label={use.name} counter={use} refTo={{ use: use.id }} size={size} />
              <ResetBadge reset={use.reset} />
            </span>
          ))}
      </div>
      <div
        className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${compact ? "" : "mt-3 border-t border-stone-100 pt-3 dark:border-stone-800"}`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className={labelClass}>Hit dice d{sheet.hitDice.die}</span>
          <Pips label="Hit dice" counter={sheet.hitDice} refTo="hitDice" size={size} />
        </span>
        <Concentration sheet={sheet} />
        <RestButtons sheet={sheet} />
      </div>
    </section>
  );
}

function Concentration({ sheet }: { sheet: ProtoSheet }) {
  if (!sheet.concentrating) {
    return <span className="text-sm text-stone-400">Not concentrating</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-sm text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
      <span aria-hidden="true">◎</span> Concentrating: <strong>{sheet.concentrating}</strong>
      <button
        type="button"
        onClick={() => protoActions.dropConcentration()}
        className="text-xs underline"
      >
        Drop
      </button>
    </span>
  );
}

/* Rests. */

function RestButtons({ sheet }: { sheet: ProtoSheet }) {
  const [shortOpen, setShortOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  return (
    <span className="ml-auto inline-flex gap-2">
      <button type="button" className={buttonClass} onClick={() => setShortOpen(true)}>
        Short rest
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          setToast(`Long rest: ${longRestSummary(sheet)}.`);
          protoActions.longRest();
        }}
      >
        Long rest
      </button>
      {shortOpen && (
        <ShortRestDialog
          sheet={sheet}
          onClose={(summary) => {
            setShortOpen(false);
            if (summary) setToast(summary);
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(undefined)} />}
    </span>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[90vw] items-center gap-3 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 shadow-lg dark:bg-stone-100 dark:text-stone-900"
    >
      <span>{message}</span>
      <button
        type="button"
        className="font-semibold text-amber-300 underline dark:text-amber-700"
        onClick={() => {
          protoActions.undo();
          onClose();
        }}
      >
        Undo
      </button>
      <button type="button" aria-label="Dismiss" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

function ShortRestDialog({
  sheet,
  onClose,
}: {
  sheet: ProtoSheet;
  onClose: (summary?: string) => void;
}) {
  const [faces, setFaces] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const die = sheet.hitDice.die;
  const left = sheet.hitDice.max - sheet.hitDice.used - faces.length;
  const healing = faces.reduce((sum, face) => sum + hitDieHealing(face, sheet.conModifier), 0);
  const after = Math.min(sheet.hp.max, sheet.hp.current + healing);
  const resets = sheet.uses.filter((use) => use.reset === "short" && use.used > 0);
  const typedFace = Number(typed);
  const typedOk = Number.isInteger(typedFace) && typedFace >= 1 && typedFace <= die;

  function add(face: number) {
    setFaces([...faces, face]);
    setTyped("");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="short-rest-heading"
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-stone-900"
      >
        <h2 id="short-rest-heading" className="font-serif text-2xl font-bold">
          Short rest
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Spend hit dice to heal: each heals its roll {signed(sheet.conModifier)} (CON), at least 1.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-semibold">d{die}</span>
          <span className="text-sm text-stone-500">
            {left} of {sheet.hitDice.max} left
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={left <= 0}
            onClick={() => {
              const parsed = parseDice(`1d${die}`);
              if (parsed.ok) add(roll(parsed.expression, defaultRng).total);
            }}
          >
            Roll a d{die}
          </button>
          <span className="text-sm text-stone-500">or rolled at the table:</span>
          <input
            aria-label={`d${die} rolled at the table`}
            inputMode="numeric"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={`${inputClass} w-14`}
          />
          <button
            type="button"
            className={buttonClass}
            disabled={left <= 0 || !typedOk}
            onClick={() => add(typedFace)}
          >
            Add
          </button>
        </div>
        {faces.length > 0 && (
          <ul aria-label="Hit dice spent" className="mt-3 space-y-1 text-sm">
            {faces.map((face, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="tabular-nums">
                  {face} {signed(sheet.conModifier)} ={" "}
                  <strong>{hitDieHealing(face, sheet.conModifier)}</strong>
                </span>
                <button
                  type="button"
                  aria-label={`Take back the ${face}`}
                  className="text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                  onClick={() => setFaces(faces.filter((_, at) => at !== index))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          Healing <strong>+{healing}</strong> → HP {after} / {sheet.hp.max}
          {after === sheet.hp.max && healing > 0 && " (full)"}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Also resets:{" "}
          {resets.length > 0 ? resets.map((use) => use.name).join(", ") : "nothing else"}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={() => onClose()}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              protoActions.shortRest(faces);
              const spent = faces.length > 0 ? `${faces.length} hit dice, +${healing} HP` : "";
              const reset = resets.map((use) => use.name).join(", ");
              onClose(`Short rest: ${[spent, reset].filter(Boolean).join("; ") || "rested"}.`);
            }}
          >
            Finish short rest
          </button>
        </div>
      </div>
    </div>
  );
}

/* Rolling. */

function RollChip({
  children,
  label,
  onRoll,
  strong = false,
}: {
  children: ReactNode;
  label: string;
  onRoll: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onRoll}
      className={`rounded-md border px-2 py-0.5 text-sm tabular-nums hover:bg-amber-50 dark:hover:bg-amber-900/30 ${
        strong
          ? "border-amber-400 font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-200"
          : "border-stone-300 dark:border-stone-700"
      }`}
    >
      {children}
    </button>
  );
}

export function AttackList({
  sheet,
  rolls,
  compact = false,
}: {
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact?: boolean;
}) {
  return (
    <ul aria-label="Attacks" className="divide-y divide-stone-100 dark:divide-stone-800">
      {sheet.attacks.map((attack) => (
        <li
          key={attack.id}
          className={`flex flex-wrap items-center gap-2 ${compact ? "py-1" : "py-2"}`}
        >
          <span className="mr-auto min-w-0">
            <span className="font-medium">{attack.name}</span>
            {attack.notes && <span className="ml-2 text-xs text-stone-500">{attack.notes}</span>}
          </span>
          <RollChip
            strong
            label={`${attack.name} attack, ${signed(attack.bonus)}`}
            onRoll={() =>
              rolls.roll({
                expression: `1d20${signed(attack.bonus)}`,
                kind: "attack",
                label: `${attack.name} attack`,
              })
            }
          >
            {signed(attack.bonus)}
          </RollChip>
          <RollChip
            label={`${attack.name} damage, ${attack.damage}`}
            onRoll={() =>
              rolls.roll({
                expression: attack.damage,
                kind: "damage",
                label: `${attack.name} damage`,
              })
            }
          >
            {attack.damage}
            {!compact && <span className="ml-1 text-xs text-stone-500">{attack.damageType}</span>}
          </RollChip>
        </li>
      ))}
    </ul>
  );
}

export function SpellList({
  sheet,
  rolls,
  compact = false,
  onNotice,
}: {
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact?: boolean;
  onNotice: (text: string) => void;
}) {
  const [filter, setFilter] = useState<SpellFilter>("all");
  const allLevels = [...new Set(sheet.spells.map((spell) => spell.level))].sort((a, b) => a - b);
  const shown = sheet.spells.filter((spell) =>
    filter === "all"
      ? true
      : filter === "concentration"
        ? spell.concentration
        : filter === "ritual"
          ? spell.ritual
          : spell.level === filter,
  );
  const levels = allLevels.filter((level) => shown.some((spell) => spell.level === level));
  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        label="Show spells"
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "All"],
          ...allLevels.map((level): [SpellFilter, string] => [
            level,
            level === 0 ? "Cantrips" : ORDINALS[level],
          ]),
          ["concentration", "Concentration"],
          ["ritual", "Ritual"],
        ]}
      />
      <p className="text-sm">
        Spellcasting <strong>{sheet.spellAbility}</strong> · Save DC{" "}
        <strong>{sheet.spellDc}</strong> · Spell attack{" "}
        <RollChip
          strong
          label={`Spell attack, ${signed(sheet.spellAttack)}`}
          onRoll={() =>
            rolls.roll({
              expression: `1d20${signed(sheet.spellAttack)}`,
              kind: "attack",
              label: "Spell attack",
            })
          }
        >
          {signed(sheet.spellAttack)}
        </RollChip>
      </p>
      {levels.map((level) => {
        const slot = level > 0 ? sheet.slots[level - 1] : undefined;
        return (
          <section key={level} aria-label={level === 0 ? "Cantrips" : `${ORDINALS[level]} level`}>
            <h3 className="flex items-center gap-3 border-b border-stone-200 pb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:border-stone-700">
              {level === 0 ? "Cantrips" : `${ORDINALS[level]} level`}
              {slot && slot.max > 0 && (
                <Pips
                  label={`${ORDINALS[level]}-level slot`}
                  counter={slot}
                  refTo={{ slot: level }}
                  size="sm"
                />
              )}
            </h3>
            <ul>
              {shown
                .filter((spell) => spell.level === level)
                .map((spell) => (
                  <SpellRow
                    key={spell.id}
                    spell={spell}
                    sheet={sheet}
                    rolls={rolls}
                    compact={compact}
                    onNotice={onNotice}
                  />
                ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SpellRow({
  spell,
  sheet,
  rolls,
  compact,
  onNotice,
}: {
  spell: Spell;
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact: boolean;
  onNotice: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = [spell.castingTime, spell.range, spell.components, spell.duration].join(" · ");
  return (
    <li className="border-b border-stone-100 py-1.5 last:border-0 dark:border-stone-800">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="mr-auto min-w-0 text-left"
        >
          <span className="font-medium">{spell.name}</span>
          {spell.concentration && <Badge title="Concentration">C</Badge>}
          {spell.ritual && <Badge title="Ritual">R</Badge>}
          {!compact && <span className="ml-2 text-xs text-stone-500">{meta}</span>}
        </button>
        {spell.attack && (
          <RollChip
            strong
            label={`${spell.name} attack, ${signed(sheet.spellAttack)}`}
            onRoll={() =>
              rolls.roll({
                expression: `1d20${signed(sheet.spellAttack)}`,
                kind: "attack",
                label: `${spell.name} attack`,
              })
            }
          >
            {signed(sheet.spellAttack)}
          </RollChip>
        )}
        {spell.save && (
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
            {spell.save.toUpperCase()} {sheet.spellDc}
          </span>
        )}
        {spell.roll && (
          <RollChip
            label={`${spell.name} ${spell.effect ?? "roll"}, ${spell.roll}`}
            onRoll={() =>
              rolls.roll({
                expression: spell.roll!,
                kind: spell.effect === "healing" ? "custom" : "damage",
                label: `${spell.name}${spell.effect ? ` (${spell.effect})` : ""}`,
              })
            }
          >
            {spell.roll}
            {!compact && spell.effect && (
              <span className="ml-1 text-xs text-stone-500">{spell.effect}</span>
            )}
          </RollChip>
        )}
        {spell.level > 0 && <CastButton spell={spell} sheet={sheet} onNotice={onNotice} />}
      </div>
      {open && (
        <div className="mt-1 space-y-1 pl-2 text-sm text-stone-600 dark:text-stone-300">
          {compact && <p className="text-xs text-stone-500">{meta}</p>}
          {spell.save && <p className="text-xs">{ABILITY_NAMES[spell.save]} save</p>}
          {spell.area && (
            <p className="text-xs">
              Area: {spell.area.feet} ft. {spell.area.shape}{" "}
              <span className="text-stone-400">(later: “Show on map”)</span>
            </p>
          )}
          <p>{spell.description}</p>
        </div>
      )}
    </li>
  );
}

function Badge({ title, children }: { title: string; children: ReactNode }) {
  return (
    <abbr
      title={title}
      className="ml-1 rounded border border-stone-300 px-1 text-[10px] font-semibold text-stone-500 no-underline dark:border-stone-600"
    >
      {children}
    </abbr>
  );
}

/** Cast: the lowest free slot at the spell's level or above; ▾ for the others. */
function CastButton({
  spell,
  sheet,
  onNotice,
}: {
  spell: Spell;
  sheet: ProtoSheet;
  onNotice: (text: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const free = spell.freeUse ? sheet.uses.find((use) => use.id === spell.freeUse) : undefined;
  const freeLeft = free ? free.max - free.used : 0;
  const slotLevels = sheet.slots
    .map((slot, index) => ({ level: index + 1, left: slot.max - slot.used }))
    .filter(({ level, left }) => level >= spell.level && left > 0);
  const options: { label: string; how: Parameters<typeof protoActions.cast>[1] }[] = [
    ...slotLevels.map(({ level, left }) => ({
      label: `With a ${ORDINALS[level]}-level slot (${left} left)`,
      how: { slot: level },
    })),
    ...(free && freeLeft > 0 ? [{ label: `Free (${free.name})`, how: { use: free.id } }] : []),
    ...(spell.ritual ? [{ label: "As a ritual (no slot)", how: "ritual" as const }] : []),
  ];
  const first = options[0];

  function cast(how: Parameters<typeof protoActions.cast>[1], label: string) {
    const replaced = protoActions.cast(spell, how);
    setMenu(false);
    onNotice(
      `Cast ${spell.name} ${label.toLowerCase()}${replaced ? `; stopped concentrating on ${replaced}` : ""}.`,
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={!first}
        onClick={() => first && cast(first.how, first.label)}
        className="rounded-l-md bg-amber-700 px-2 py-0.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:bg-stone-300 disabled:text-stone-600 dark:disabled:bg-stone-700 dark:disabled:text-stone-400"
      >
        {first ? "Cast" : "No slots"}
      </button>
      <button
        type="button"
        aria-label={`Other ways to cast ${spell.name}`}
        aria-expanded={menu}
        disabled={options.length < 2}
        onClick={() => setMenu(!menu)}
        className="rounded-r-md border-l border-amber-900/30 bg-amber-700 px-1.5 text-sm text-white hover:bg-amber-800 disabled:bg-stone-300 disabled:text-stone-500 dark:disabled:bg-stone-700"
      >
        ▾
      </button>
      {menu && (
        <ul className="absolute top-full right-0 z-20 mt-1 w-56 rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {options.map((option) => (
            <li key={option.label}>
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800"
                onClick={() => cast(option.how, option.label)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Saves and skills to roll, folded away by default in the compact view. */
export function ChecksList({ sheet, rolls }: { sheet: ProtoSheet; rolls: RollLogControls }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold tracking-wide text-stone-500 uppercase">
        Checks &amp; saves
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...sheet.saves, ...sheet.skills].map(({ label, bonus }) => (
          <RollChip
            key={label}
            label={`${label}, ${signed(bonus)}`}
            onRoll={() => rolls.roll({ expression: `1d20${signed(bonus)}`, kind: "check", label })}
          >
            {label} {signed(bonus)}
          </RollChip>
        ))}
      </div>
    </details>
  );
}

/** The latest roll, briefly, wherever it's put. */
export function LatestRoll({
  rolls,
  floating = false,
}: {
  rolls: RollLogControls;
  floating?: boolean;
}) {
  const latest = rolls.log.rolls[0];
  if (!latest) return null;
  const text = (
    <>
      {latest.label}: <strong className="text-lg">{latest.result.total}</strong>
      <span className="ml-1 text-xs opacity-70">({latest.result.expression})</span>
      {latest.critical && " · Critical!"}
      {latest.result.natural === 20 && " · Natural 20!"}
      {latest.result.natural === 1 && " · Natural 1"}
    </>
  );
  if (!floating) {
    return (
      <p role="status" aria-label="Last roll" className="text-sm">
        {text}
      </p>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-4"
    >
      <p
        key={latest.id}
        className="animate-[fade_4s_ease-in_forwards] rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 shadow-lg dark:bg-stone-100 dark:text-stone-900"
      >
        {text}
      </p>
    </div>
  );
}

/** Switches between the two pip styles, to try them. */
export function PipStyleSwitch({
  value,
  onChange,
}: {
  value: PipStyle;
  onChange: (style: PipStyle) => void;
}) {
  return (
    <fieldset className="flex items-center gap-3 text-sm">
      <legend className="sr-only">Pips</legend>
      <span className="text-stone-500">Pips:</span>
      {(
        [
          ["left", "Lit = left (games)"],
          ["used", "Ticked = used (paper)"],
        ] as const
      ).map(([style, label]) => (
        <label key={style} className="flex items-center gap-1">
          <input
            type="radio"
            name="pip-style"
            checked={value === style}
            onChange={() => onChange(style)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

/* Filters, features and the Actions tab. */

type SpellFilter = "all" | number | "concentration" | "ritual";

/** A row of chips choosing what a list shows, one at a time. */
export function FilterChips<T extends string | number>({
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
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map(([key, text]) => (
        <button
          key={String(key)}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            value === key
              ? "bg-amber-700 text-white dark:bg-amber-600"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A feature: its name (click for its note), its uses as pips, and its roll. */
function FeatureRow({
  feature,
  sheet,
  rolls,
  compact,
  showActivation = false,
}: {
  feature: Feature;
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact: boolean;
  showActivation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const use = feature.use ? sheet.uses.find((each) => each.id === feature.use) : undefined;
  return (
    <li
      className={`border-b border-stone-100 last:border-0 dark:border-stone-800 ${compact ? "py-1" : "py-1.5"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="mr-auto min-w-0 text-left"
        >
          <span className="font-medium">{feature.name}</span>
          <span className="ml-2 text-[11px] text-stone-500">
            {feature.sourceName ?? SOURCE_LABELS[feature.source]}
          </span>
          {showActivation && (
            <span className="ml-2 text-[11px] text-stone-400">
              {ACTIVATION_LABELS[feature.activation]}
            </span>
          )}
        </button>
        {use && (
          <span className="inline-flex items-center gap-1.5">
            <Pips label={use.name} counter={use} refTo={{ use: use.id }} size="sm" />
            <ResetBadge reset={use.reset} />
          </span>
        )}
        {feature.roll && (
          <RollChip
            label={`${feature.name}, ${feature.roll}`}
            onRoll={() =>
              rolls.roll({ expression: feature.roll!, kind: "custom", label: feature.name })
            }
          >
            {feature.roll}
          </RollChip>
        )}
      </div>
      {open && feature.note && (
        <p className="mt-0.5 pl-2 text-sm text-stone-600 dark:text-stone-300">{feature.note}</p>
      )}
    </li>
  );
}

type Activated = Exclude<Activation, "passive">;
type ActionFilter = "all" | "attack" | Activated | "limited";

const ACTION_GROUPS = ACTIVATIONS.filter(
  (activation): activation is Activated => activation !== "passive",
);

/**
 * Everything the character can do: attacks first, then features by how they're used. A
 * feature with limited uses shows its pips where it's used.
 */
export function ActionsList({
  sheet,
  rolls,
  compact = false,
}: {
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const groups = ACTION_GROUPS.map((activation) => ({
    activation,
    features: sheet.features.filter(
      (feature) =>
        feature.activation === activation &&
        (filter === "all" || filter === activation || (filter === "limited" && !!feature.use)),
    ),
  })).filter((group) => group.features.length > 0);
  const showAttacks = filter === "all" || filter === "attack" || filter === "action";

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        label="Show actions"
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "All"],
          ["attack", "Attack"],
          ["action", "Action"],
          ["bonus", compact ? "Bonus" : "Bonus action"],
          ["reaction", "Reaction"],
          ["other", "Other"],
          ["limited", compact ? "Limited" : "Limited use"],
        ]}
      />
      {showAttacks && (
        <section aria-label="Attacks">
          <h3 className={labelClass}>Attacks</h3>
          <AttackList sheet={sheet} rolls={rolls} compact={compact} />
        </section>
      )}
      {filter !== "attack" &&
        groups.map(({ activation, features }) => (
          <section key={activation} aria-label={ACTIVATION_LABELS[activation]}>
            <h3 className={labelClass}>
              {activation === "other" ? "Other" : `${ACTIVATION_LABELS[activation]}s`}
            </h3>
            <ul>
              {features.map((feature) => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  sheet={sheet}
                  rolls={rolls}
                  compact={compact}
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** Every feature, trait and item power, passive ones included, by where it comes from. */
export function FeatureList({
  sheet,
  rolls,
  compact = false,
}: {
  sheet: ProtoSheet;
  rolls: RollLogControls;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | Source>("all");
  const present = SOURCES.filter((source) => sheet.features.some((f) => f.source === source));
  const groups = present
    .map((source) => ({
      source,
      features: sheet.features.filter(
        (feature) => feature.source === source && (filter === "all" || filter === source),
      ),
    }))
    .filter((group) => group.features.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        label="Show features"
        value={filter}
        onChange={setFilter}
        options={[
          ["all", "All"],
          ...present.map((source): ["all" | Source, string] => [source, SOURCE_LABELS[source]]),
        ]}
      />
      {groups.map(({ source, features }) => (
        <section key={source} aria-label={SOURCE_LABELS[source]}>
          <h3 className={labelClass}>{source === "item" ? "From items" : SOURCE_LABELS[source]}</h3>
          <ul>
            {features.map((feature) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                sheet={sheet}
                rolls={rolls}
                compact={compact}
                showActivation
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
