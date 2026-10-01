import type { ReactNode } from "react";
import type { EncounterView } from "~/combat/visibility";
import { initials } from "~/components/maps/TokenLayer";

interface Props {
  round: number;
  /** `dim`: for the DM, a monster that's down or hidden from players. */
  turnOrder: readonly (EncounterView["turnOrder"][number] & { dim?: boolean })[];
  /** Over a map, centred across its top; otherwise in the page. */
  floating?: boolean;
  onSelect?: (id: string) => void;
  /** Beside the round: "End my turn", for a player whose turn it is. */
  children?: ReactNode;
}

/**
 * Who's in the fight, in turn order, like a game's turn order: whose turn it is now, and who's
 * next. Monsters and the party in different colours.
 */
export function TurnStrip({ round, turnOrder, floating = false, onSelect, children }: Props) {
  const active = turnOrder.find((entry) => entry.isActive);
  return (
    <div
      className={
        floating
          ? "pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-1"
          : "flex flex-col items-start gap-2"
      }
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <p
          role="status"
          aria-label="Whose turn"
          className="rounded-full bg-stone-900/85 px-3 py-1 text-sm font-semibold text-white shadow"
        >
          Round {round} · {active ? `${active.name}'s turn` : "between turns"}
        </p>
        {children}
      </div>
      <ol
        aria-label="Turn strip"
        className="pointer-events-auto flex max-w-[90%] gap-1 overflow-x-auto rounded-full bg-white/90 p-1 shadow dark:bg-stone-900/90"
      >
        {turnOrder.map((entry) => (
          <li key={entry.id} aria-current={entry.isActive ? "true" : undefined}>
            <button
              type="button"
              title={entry.name}
              aria-label={entry.name}
              disabled={!onSelect}
              onClick={() => onSelect?.(entry.id)}
              className={`flex size-9 items-center justify-center rounded-full font-serif text-sm font-bold text-white ${
                entry.isActive ? "ring-3 ring-amber-500" : ""
              } ${entry.kind === "monster" ? "bg-red-700" : "bg-stone-700"} ${
                entry.dim ? "opacity-40" : ""
              }`}
            >
              {initials(entry.name)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
