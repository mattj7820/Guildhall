import { toPixels } from "~/maps/geometry";
import { feetBetween, formatFeet } from "~/maps/grid/distance";
import { toPixels as gridInPixels, type MapGrid } from "~/maps/grid/grid";
import type { TokenView } from "~/maps/tokens/types";
import type { Size } from "~/maps/types";

/**
 * How far every other token is from one, nearest first, centre to centre at the grid's scale:
 * a quick check, and measuring without a mouse.
 */
export function TokenDistances({
  from,
  tokens,
  grid,
  size,
}: {
  from: TokenView;
  tokens: readonly TokenView[];
  grid: MapGrid;
  size: Size;
}) {
  const squares = gridInPixels(grid, size);
  const origin = toPixels(from.at, size);
  const others = tokens
    .filter((token) => token.id !== from.id)
    .map((token) => ({ token, feet: feetBetween(squares, origin, toPixels(token.at, size)) }))
    .sort((a, b) => a.feet - b.feet);
  if (others.length === 0) return null;
  return (
    <ul aria-label={`Distances from ${from.name}`} className="flex flex-col text-sm">
      {others.map(({ token, feet }) => (
        <li key={token.id} className="flex justify-between gap-2">
          <span>{token.name}</span>
          <span className="text-muted tabular-nums">{formatFeet(feet)}</span>
        </li>
      ))}
    </ul>
  );
}
