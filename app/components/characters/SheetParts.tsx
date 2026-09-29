/** Small building blocks of the character sheet. */
import type { ReactNode } from "react";
import { signed, type Proficiency } from "~/characters/abilities";
import type { DerivedValue } from "~/characters/derive";
import type { HitPoints } from "~/characters/types";

export const sheetPanelClass =
  "rounded-lg border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-900";

export const sheetHeadingClass =
  "text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400";

/** A labelled panel of the sheet. */
export function SheetPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`${sheetPanelClass} ${className}`}>
      <h2 id={id} className={sheetHeadingClass}>
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** A number shown as a bonus, "+3", marked when it has been typed over. */
export function Bonus({ value, className = "" }: { value: DerivedValue; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {signed(value.value)}
      {value.overridden && <OverrideMark computed={value.computed} signedValue />}
    </span>
  );
}

/** A small dot on a number that was typed rather than worked out. */
export function OverrideMark({
  computed,
  signedValue = false,
}: {
  computed: number;
  signedValue?: boolean;
}) {
  const text = `typed over; the sheet works out ${signedValue ? signed(computed) : computed}`;
  return (
    <span title={text} className="ml-0.5 align-super text-[10px] text-amber-600">
      •<span className="sr-only"> ({text})</span>
    </span>
  );
}

const MARKS: Record<Proficiency, { symbol: string; label: string }> = {
  none: { symbol: "○", label: "not proficient" },
  proficient: { symbol: "●", label: "proficient" },
  expertise: { symbol: "◉", label: "expertise" },
};

/** ○ not proficient, ● proficient, ◉ expertise, as on the paper sheet. */
export function ProficiencyMark({ proficiency }: { proficiency: Proficiency }) {
  const mark = MARKS[proficiency];
  return (
    <span
      className={
        proficiency === "none"
          ? "text-stone-300 dark:text-stone-600"
          : "text-amber-700 dark:text-amber-400"
      }
    >
      <span aria-hidden="true">{mark.symbol}</span>
      <span className="sr-only">{mark.label}</span>
    </span>
  );
}

/** A big number with a label, for AC, initiative, speed and the like. */
export function StatBox({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${sheetPanelClass} flex flex-col items-center justify-center text-center ${className}`}
    >
      <span className={sheetHeadingClass}>{label}</span>
      <span className="mt-1 text-2xl font-bold">{children}</span>
    </div>
  );
}

/** Current, maximum and temporary hit points. */
export function HitPointsView({ hp }: { hp: HitPoints }) {
  return (
    <div className="flex items-end justify-center gap-4">
      <HpNumber label="Current" value={hp.current} large />
      <span aria-hidden="true" className="pb-1 text-2xl text-stone-400">
        /
      </span>
      <HpNumber label="Max" value={hp.max} />
      <HpNumber label="Temp" value={hp.temp} muted={hp.temp === 0} />
    </div>
  );
}

function HpNumber({
  label,
  value,
  large = false,
  muted = false,
}: {
  label: string;
  value: number;
  large?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] text-stone-500 uppercase">{label}</span>
      <span
        className={`tabular-nums ${large ? "text-3xl font-bold" : "text-2xl font-semibold"} ${muted ? "text-stone-400" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/** A free-text part of the sheet (senses, languages…), keeping the player's line breaks. */
export function TextBlock({ text, empty = "—" }: { text: string; empty?: string }) {
  return text.trim() ? (
    <p className="text-sm whitespace-pre-line">{text}</p>
  ) : (
    <p className="text-sm text-stone-400">{empty}</p>
  );
}
