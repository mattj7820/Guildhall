import type { InventoryChange } from "~/characters/inventory-changes";
import { COINS, type Coin, type Purse as PurseValue } from "~/characters/types";

const COIN_NAMES: Record<Coin, string> = {
  cp: "Copper",
  sp: "Silver",
  ep: "Electrum",
  gp: "Gold",
  pp: "Platinum",
};

const COIN_COLOURS: Record<Coin, string> = {
  cp: "bg-orange-700",
  sp: "bg-stone-400",
  ep: "bg-sky-300",
  gp: "bg-amber-400",
  pp: "bg-slate-200",
};

/** Coins, kept apart from the tiles: they're counted, not carried around the grid. */
export function Purse({
  purse,
  onChange,
}: {
  purse: PurseValue;
  onChange: (change: InventoryChange) => void;
}) {
  return (
    <fieldset className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-stone-100/70 px-3 py-2 dark:bg-stone-900/70">
      <legend className="sr-only">Coins</legend>
      {COINS.map((coin) => (
        <label key={coin} className="flex items-center gap-1.5 text-sm">
          <span
            aria-hidden="true"
            className={`h-3.5 w-3.5 rounded-full ring-1 ring-stone-900/20 ${COIN_COLOURS[coin]}`}
          />
          <input
            key={purse[coin]}
            type="number"
            min={0}
            defaultValue={purse[coin]}
            aria-label={COIN_NAMES[coin]}
            onBlur={(event) => {
              const amount = Number(event.target.value);
              if (amount !== purse[coin]) onChange({ type: "purse", coin, amount });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className={`w-16 rounded border border-transparent bg-transparent px-1 text-right tabular-nums hover:border-stone-300 focus:border-stone-400 dark:hover:border-stone-700 ${coin === "gp" ? "font-bold" : ""}`}
          />
          <span className="text-stone-500">{coin}</span>
        </label>
      ))}
    </fieldset>
  );
}
