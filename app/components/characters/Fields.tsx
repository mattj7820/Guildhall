/**
 * Inputs for editing the sheet. Each commits when you leave it or press Enter (not on every key),
 * and resets itself when the saved value changes, for instance when the DM changes it.
 */
import { inputClass } from "../styles";

interface Common {
  label: string;
  /** Show the label to sighted users too, above the field. */
  showLabel?: boolean;
  className?: string;
}

export function NumberField({
  label,
  showLabel = false,
  value,
  min,
  max,
  onCommit,
  className = "w-16",
}: Common & {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  return (
    <Labelled label={label} show={showLabel}>
      <input
        key={value}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        defaultValue={value}
        aria-label={showLabel ? undefined : label}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (event.target.value === "" || !Number.isInteger(next)) {
            event.target.value = String(value);
            return;
          }
          const clamped = Math.max(min, Math.min(max, next));
          event.target.value = String(clamped);
          if (clamped !== value) onCommit(clamped);
        }}
        onKeyDown={commitOnEnter}
        className={`${inputClass} text-center tabular-nums ${className}`}
      />
    </Labelled>
  );
}

/** A number that can be typed over a computed one; blank goes back to the computed number. */
export function OverrideField({
  label,
  value,
  computed,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  computed: number;
  onCommit: (value: number | undefined) => void;
}) {
  return (
    <input
      key={value ?? "computed"}
      type="number"
      inputMode="numeric"
      min={-99}
      max={99}
      defaultValue={value}
      placeholder={String(computed)}
      aria-label={`${label}: type a number to use instead of ${computed}, or leave blank`}
      title="Leave blank to use the worked-out number"
      onBlur={(event) => {
        const text = event.target.value.trim();
        const next = text === "" ? undefined : Number(text);
        if (next !== undefined && (!Number.isInteger(next) || Math.abs(next) > 99)) {
          event.target.value = value === undefined ? "" : String(value);
          return;
        }
        if (next !== value) onCommit(next);
      }}
      onKeyDown={commitOnEnter}
      className={`${inputClass} w-14 px-1 text-center tabular-nums placeholder:text-stone-400`}
    />
  );
}

export function TextField({
  label,
  showLabel = false,
  value,
  maxLength,
  placeholder,
  onCommit,
  className = "w-full",
}: Common & {
  value: string;
  maxLength: number;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <Labelled label={label} show={showLabel}>
      <input
        key={value}
        defaultValue={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={showLabel ? undefined : label}
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next !== value) onCommit(next);
        }}
        onKeyDown={commitOnEnter}
        className={`${inputClass} ${className}`}
      />
    </Labelled>
  );
}

export function TextAreaField({
  label,
  value,
  maxLength,
  rows = 3,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  maxLength: number;
  rows?: number;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <textarea
      key={value}
      defaultValue={value}
      maxLength={maxLength}
      rows={rows}
      placeholder={placeholder}
      aria-label={label}
      onBlur={(event) => {
        if (event.target.value !== value) onCommit(event.target.value);
      }}
      className={`${inputClass} w-full`}
    />
  );
}

function Labelled({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <label className="flex flex-col gap-0.5 text-xs text-stone-600 dark:text-stone-400">
      {label}
      {children}
    </label>
  );
}

function commitOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}
