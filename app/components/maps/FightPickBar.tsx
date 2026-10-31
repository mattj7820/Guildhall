import type { ReactNode } from "react";
import { buttonClass } from "~/components/styles";
import { inTheFight } from "~/maps/tokens/picking";
import type { TokenView } from "~/maps/tokens/types";

/**
 * Over the map: the picked tokens a fight can be started with (or that can join the running one),
 * as the DM picks them. Party members join as themselves and markers as their monster; a marker
 * without a statblock can't join, and says so. Tokens already in the fight are left to the
 * tracker, which damages them together.
 */
export function FightPickBar({
  picked,
  onClear,
  children,
}: {
  picked: readonly TokenView[];
  onClear: () => void;
  /** What's done with them. */
  children?: ReactNode;
}) {
  const outside = picked.filter((token) => !inTheFight(token));
  if (outside.length === 0) return null;
  const cannot = outside.filter((token) => token.kind === "marker" && !token.marker?.statblock);
  return (
    <section
      aria-label="Picked for a fight"
      className="absolute bottom-3 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
    >
      <ul aria-label="Picked" className="flex flex-wrap gap-1">
        {outside.map((token) => {
          const joins = token.kind !== "marker" || !!token.marker?.statblock;
          return (
            <li
              key={token.id}
              className={`rounded px-1.5 py-0.5 ${joins ? "bg-raised text-ink" : "bg-warn-surface text-warn"}`}
            >
              <span aria-hidden>{token.kind === "marker" ? (joins ? "⚔ " : "") : "🛡 "}</span>
              {token.name}
              {joins && token.hidden === "secret" && (
                <span className="ml-1 text-xs text-muted">hidden</span>
              )}
            </li>
          );
        })}
      </ul>
      {cannot.length > 0 && (
        <p className="text-xs text-warn">
          {cannot.map((token) => token.name).join(", ")} {cannot.length > 1 ? "have" : "has"} no
          statblock, so can&rsquo;t join a fight. Give {cannot.length > 1 ? "them one" : "it one"}{" "}
          in the Tokens tab.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button type="button" className={buttonClass} onClick={onClear}>
          Clear
        </button>
        <span className="text-xs text-muted">Shift-click or Shift-drag to pick more</span>
      </div>
    </section>
  );
}
