/** Small label for a note's entity type (`npc`, `location`, …). */
export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-stone-600 uppercase dark:bg-stone-800 dark:text-stone-400">
      {type}
    </span>
  );
}
