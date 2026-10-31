import { useRef, type KeyboardEvent } from "react";
import { useFetcher, useSearchParams } from "react-router";
import type { OwnedDieView } from "~/dice/collection";
import { DIE_TYPES, RARITIES, RARITY_INFO, type DieType } from "~/dice/styles";
import { DieIcon } from "./DieIcon";
import { DiePicture } from "./DiePicture";
import { TryDice } from "./TryDice";

/**
 * Choosing the dice each type rolls with: a slot for each type showing the die it rolls first,
 * and that type's dice by rarity, one click to roll one first. The type shown is in the URL
 * (`?type=20`), so it stays put after a choice.
 */
export function DicePicker({
  owned,
  favourites,
}: {
  owned: OwnedDieView[];
  favourites: Partial<Record<DieType, string>>;
}) {
  const [params, setParams] = useSearchParams();
  const fetcher = useFetcher<{ error?: string }>();
  const tabs = useRef<Partial<Record<DieType, HTMLButtonElement | null>>>({});
  const ofType = (sides: DieType) => owned.filter((die) => die.sides === sides);
  const asked = Number(params.get("type"));
  const shown: DieType =
    DIE_TYPES.find((sides) => sides === asked) ??
    DIE_TYPES.find((sides) => sides === 20 && ofType(20).length > 0) ??
    DIE_TYPES.find((sides) => ofType(sides).length > 0) ??
    20;

  // A choice shows at once, before the server has it.
  const choosing =
    fetcher.formData && Number(fetcher.formData.get("sides")) === shown
      ? { sides: shown, style: String(fetcher.formData.get("style")) }
      : undefined;
  const chosen = (sides: DieType) =>
    choosing?.sides === sides ? choosing.style || undefined : favourites[sides];
  // Without a choice the rarest goes first; the list is rarest first already.
  const first = (sides: DieType) => {
    const dice = ofType(sides);
    return dice.find((die) => die.style.id === chosen(sides)) ?? dice[0];
  };

  const show = (sides: DieType) =>
    setParams({ type: String(sides) }, { replace: true, preventScrollReset: true });
  const arrows = (event: KeyboardEvent, sides: DieType) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = DIE_TYPES[(DIE_TYPES.indexOf(sides) + step + DIE_TYPES.length) % DIE_TYPES.length];
    show(next);
    tabs.current[next]?.focus();
  };

  const dice = ofType(shown);
  const firstShown = first(shown);
  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Your dice by type"
        className="grid grid-cols-3 gap-2 sm:grid-cols-6"
      >
        {DIE_TYPES.map((sides) => {
          const die = first(sides);
          const selected = sides === shown;
          return (
            <button
              key={sides}
              ref={(button) => {
                tabs.current[sides] = button;
              }}
              type="button"
              role="tab"
              id={`dice-tab-${sides}`}
              aria-selected={selected}
              aria-controls="dice-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => show(sides)}
              onKeyDown={(event) => arrows(event, sides)}
              className={`gh-card flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${
                selected
                  ? "border-accent bg-accent-surface ring-accent ring-2"
                  : "border-line bg-surface hover:border-accent"
              }`}
            >
              <span className="font-display text-title text-lg">d{sides}</span>
              {die ? (
                <DiePicture sides={sides} style={die.style} size={48} />
              ) : (
                <DieIcon sides={sides} size={48} />
              )}
              <span className="text-muted line-clamp-1 text-xs">
                {die ? die.style.label : "Theme's dice"}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="dice-panel"
        role="tabpanel"
        aria-labelledby={`dice-tab-${shown}`}
        aria-label={`d${shown}`}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-title text-xl">d{shown}</h3>
          <p className="text-muted text-sm">
            {firstShown ? (
              <>
                Rolls <strong className="text-ink">{firstShown.style.label}</strong> first
                {chosen(shown) ? "" : " (your rarest)"}, then your others, rarest first.
              </>
            ) : (
              <>You haven&rsquo;t found any yet: you roll the theme&rsquo;s dice.</>
            )}
          </p>
          {dice.length > 0 && <TryDice sides={shown} />}
          {chosen(shown) && (
            <fetcher.Form method="post" className="ml-auto">
              <input type="hidden" name="sides" value={shown} />
              <button type="submit" name="style" value="" className="text-link text-sm">
                Rarest first instead
              </button>
            </fetcher.Form>
          )}
        </div>

        {fetcher.state === "idle" && fetcher.data?.error && (
          <p role="alert" className="bg-danger-surface text-danger rounded-md px-3 py-2 text-sm">
            {fetcher.data.error}
          </p>
        )}
        {[...RARITIES].reverse().map((rarity) => {
          const group = dice.filter((die) => die.style.rarity === rarity);
          if (group.length === 0) return null;
          const info = RARITY_INFO[rarity];
          return (
            <div key={rarity} className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: info.colour }}
                />
                {info.label}
              </h4>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {group.map((die) => (
                  <DieTile
                    key={die.style.id}
                    die={die}
                    first={die.style.id === firstShown?.style.id}
                    chosen={die.style.id === chosen(shown)}
                    fetcher={fetcher}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/** One die: a click rolls it first, or (if it's the choice already) goes back to rarest first. */
function DieTile({
  die,
  first,
  chosen,
  fetcher,
}: {
  die: OwnedDieView;
  first: boolean;
  chosen: boolean;
  fetcher: ReturnType<typeof useFetcher<{ error?: string }>>;
}) {
  const { style, sides, count } = die;
  const rarity = RARITY_INFO[style.rarity];
  return (
    <li>
      <fetcher.Form method="post" className="h-full">
        <input type="hidden" name="sides" value={sides} />
        <button
          type="submit"
          name="style"
          value={chosen ? "" : style.id}
          aria-pressed={first}
          aria-label={`${style.label} d${sides}`}
          title={style.description}
          className={`gh-card relative flex h-full w-full items-center gap-2 rounded-lg border p-2 text-left ${
            first
              ? "border-accent bg-accent-surface ring-accent ring-2"
              : "border-line bg-surface hover:border-accent"
          }`}
          style={{ borderLeftColor: first ? undefined : rarity.colour, borderLeftWidth: 4 }}
        >
          <DiePicture sides={sides} style={style} size={48} />
          <span className="flex min-w-0 flex-col">
            <span className="text-title truncate font-semibold">
              {style.label}
              {count > 1 && <span className="text-muted font-normal"> ×{count}</span>}
            </span>
            <span className="text-muted line-clamp-2 text-xs">{style.description}</span>
          </span>
          {first && (
            <span className="bg-accent text-on-accent absolute -top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold">
              ✓ Rolled first
            </span>
          )}
        </button>
      </fetcher.Form>
    </li>
  );
}
