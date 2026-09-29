import { useId } from "react";
import { purseInGold, type InventoryChange } from "~/characters/inventory-changes";
import { COINS, type Coin, type Purse as PurseValue } from "~/characters/types";

interface Metal {
  name: string;
  letter: string;
  /** Highlight, face and rim colours. */
  light: string;
  face: string;
  rim: string;
}

const METALS: Record<Coin, Metal> = {
  cp: { name: "Copper", letter: "C", light: "#f6c29b", face: "#c0703d", rim: "#7a3d17" },
  sp: { name: "Silver", letter: "S", light: "#ffffff", face: "#c3c7cc", rim: "#6b7280" },
  ep: { name: "Electrum", letter: "E", light: "#fbf7d5", face: "#cfc27a", rim: "#7d7131" },
  gp: { name: "Gold", letter: "G", light: "#fff3b0", face: "#e0a82e", rim: "#8a5a0a" },
  pp: { name: "Platinum", letter: "P", light: "#ffffff", face: "#d5dde8", rim: "#5f6f86" },
};

/** Coins, kept apart from the tiles: they're counted, not carried around the grid. */
export function Purse({
  purse,
  onChange,
}: {
  purse: PurseValue;
  onChange: (change: InventoryChange) => void;
}) {
  const total = purseInGold(purse);
  return (
    <fieldset className="mt-4 rounded-lg bg-stone-100/70 px-3 pt-1 pb-2 dark:bg-stone-900/70">
      <legend className="sr-only">Coins</legend>
      <div className="flex items-baseline justify-between py-1">
        <span
          aria-hidden="true"
          className="text-xs font-semibold tracking-wide text-stone-500 uppercase"
        >
          Coins
        </span>
        <span className="text-xs text-stone-500">
          Worth {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} gp in all
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {COINS.map((coin) => (
          <label
            key={coin}
            className="flex flex-col items-center rounded-md px-1 py-1 focus-within:bg-white hover:bg-white dark:focus-within:bg-stone-800 dark:hover:bg-stone-800"
          >
            <CoinArt coin={coin} className="h-7 w-7 drop-shadow-sm" />
            <input
              key={purse[coin]}
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={purse[coin]}
              aria-label={METALS[coin].name}
              onBlur={(event) => {
                const amount = Number(event.target.value);
                if (amount !== purse[coin]) onChange({ type: "purse", coin, amount });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className={`mt-0.5 w-full min-w-0 [appearance:textfield] rounded border border-transparent bg-transparent text-center tabular-nums hover:border-stone-300 focus:border-stone-400 dark:hover:border-stone-700 [&::-webkit-inner-spin-button]:appearance-none ${coin === "gp" ? "font-bold" : ""}`}
            />
            <span aria-hidden="true" className="text-[11px] text-stone-500">
              {coin}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A small drawn coin: a shaded face, a milled edge and the metal's initial. */
export function CoinArt({ coin, className }: { coin: Coin; className?: string }) {
  const metal = METALS[coin];
  const shine = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <radialGradient id={shine} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={metal.light} />
          <stop offset="0.55" stopColor={metal.face} />
          <stop offset="1" stopColor={metal.rim} />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={metal.rim} />
      <circle cx="16" cy="16" r="13.5" fill={`url(#${shine})`} />
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="none"
        stroke={metal.rim}
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="1.4 1.6"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="Georgia, 'Palatino Linotype', serif"
        fontSize="14"
        fontWeight="700"
        fill={metal.rim}
      >
        {metal.letter}
      </text>
    </svg>
  );
}
