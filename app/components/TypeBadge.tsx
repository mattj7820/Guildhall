/** Small label for a note's entity type (`npc`, `location`, …). */
export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="shrink-0 rounded-full bg-raised px-2 ring-1 ring-line py-0.5 text-[0.65rem] font-semibold tracking-wide text-muted uppercase">
      {type}
    </span>
  );
}
