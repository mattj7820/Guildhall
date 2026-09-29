import { iconButtonClass } from "~/components/styles";
import { areaRevealed } from "~/maps/fog/coverage";
import type { FogMask } from "~/maps/fog/types";
import type { AreaView } from "~/maps/types";

interface Props {
  areas: AreaView[];
  mask: FogMask;
  shared: boolean;
  onReveal: (area: AreaView) => void;
  onHide: (area: AreaView) => void;
}

/**
 * Each area and whether players see it, with a way to reveal or hide it that works from the
 * keyboard too. Players see an area once at least half of it is revealed, unless it's secret.
 */
export function FogAreaList({ areas, mask, shared, onReveal, onHide }: Props) {
  const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section aria-labelledby="fog-areas-heading" className="flex flex-col gap-2">
      <h2
        id="fog-areas-heading"
        className="text-xs font-semibold tracking-wide text-stone-500 uppercase"
      >
        What players see
      </h2>
      {!shared && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          This map isn't shared yet, so players see none of it. You can reveal parts ready for when
          it is.
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-stone-500">No areas outlined on this map.</p>
      ) : (
        <ul aria-label="Areas under the fog" className="flex flex-col text-sm">
          {sorted.map((area) => {
            const seen = !area.secret && areaRevealed(mask, area.outline);
            return (
              <li
                key={area.id}
                className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {area.secret ? "🔒" : seen ? "👁" : "▒"}
                </span>
                <span className="mr-auto">
                  {area.name}
                  <span className="sr-only">: </span>
                  <span className="block text-xs text-stone-500">
                    {area.secret ? "Secret" : seen ? "Players see it" : "Under the fog"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Reveal ${area.name}`}
                  className={iconButtonClass}
                  onClick={() => onReveal(area)}
                >
                  Reveal
                </button>
                <button
                  type="button"
                  aria-label={`Hide ${area.name}`}
                  className={iconButtonClass}
                  onClick={() => onHide(area)}
                >
                  Hide
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
