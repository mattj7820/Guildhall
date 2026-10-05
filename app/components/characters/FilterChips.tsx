/** A row of chips choosing what a list shows, one at a time: "All", "Bonus action"… */
export function FilterChips<T extends string | number>({
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
