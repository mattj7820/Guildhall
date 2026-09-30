import { buttonClass, inputClass } from "~/components/styles";
import type { EditorAction } from "~/maps/editor";
import {
  fromPixels,
  SMALLEST_SQUARE,
  squaresAcross,
  startingGrid,
  suggestSquare,
  toPixels,
  type MapGrid,
  type PixelGrid,
} from "~/maps/grid/grid";
import type { Size } from "~/maps/types";

/** The scale slider moves like zooming, so small squares are as easy to set as big ones. */
const toSlider = (square: number) => Math.log(square);
const fromSlider = (value: number) => Math.round(Math.exp(value) * 2) / 2;

interface Props {
  grid?: MapGrid;
  /** The image's size in pixels, which the map's outlines were drawn against. */
  size: Size;
  dispatch: (action: EditorAction) => void;
}

/**
 * Turns a map into a battle map: a grid of 5 ft squares over it. Its scale sizes the squares, and
 * so the tokens on it; the offset lines it up with a grid drawn into the image; the lines can be
 * faint, or hidden where the image has its own.
 */
export function GridSettings({ grid, size, dispatch }: Props) {
  const suggested = suggestSquare(size);
  const pixels = grid && toPixels(grid, size);
  const set = (next: Partial<PixelGrid>, lines = grid?.lines ?? 0.35) =>
    pixels && dispatch({ type: "setGrid", grid: fromPixels({ ...pixels, ...next }, size, lines) });

  return (
    <details
      open={!!grid}
      className="rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800"
    >
      <summary className="cursor-pointer font-semibold">Battle map grid</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!grid}
            onChange={(event) =>
              dispatch({ type: "setGrid", grid: event.target.checked ? startingGrid(size) : null })
            }
          />
          A grid of 5 ft squares over the map
        </label>
        {grid && pixels && (
          <>
            <label className="flex flex-col gap-1">
              <span>Scale: about {squaresAcross(pixels, size).join(" × ")} squares</span>
              <input
                type="range"
                aria-label="Grid scale"
                min={toSlider(SMALLEST_SQUARE)}
                max={toSlider(Math.min(size.width, size.height) / 4)}
                step={0.005}
                value={toSlider(pixels.square)}
                onChange={(event) => set({ square: fromSlider(Number(event.target.value)) })}
              />
            </label>
            <div className="flex items-center gap-1">
              <Nudge
                label="Smaller squares"
                onClick={() => set({ square: Math.max(SMALLEST_SQUARE, pixels.square - 0.5) })}
              >
                −
              </Nudge>
              <input
                type="number"
                aria-label="Square size in pixels"
                min={SMALLEST_SQUARE}
                step={0.5}
                className={`${inputClass} w-20`}
                value={round(pixels.square)}
                onChange={(event) =>
                  set({ square: Math.max(SMALLEST_SQUARE, Number(event.target.value) || 0) })
                }
              />
              <Nudge label="Bigger squares" onClick={() => set({ square: pixels.square + 0.5 })}>
                +
              </Nudge>
              <span className="ml-1 text-stone-500">pixels a square</span>
            </div>
            {suggested && round(pixels.square) !== suggested && (
              <p className="text-stone-500">
                This image fits {suggested}-pixel squares exactly (
                {squaresAcross({ square: suggested, x: 0, y: 0 }, size).join(" × ")}).{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => set({ square: suggested, x: 0, y: 0 })}
                >
                  Use them
                </button>
              </p>
            )}
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1">Offset, to line up with a grid in the image</legend>
              {(["x", "y"] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-1">
                  <span className="w-20 text-stone-500">{axis === "x" ? "Across" : "Down"}</span>
                  <Nudge
                    label={`Offset ${axis === "x" ? "left" : "up"}`}
                    onClick={() => set({ [axis]: pixels[axis] - 0.5 })}
                  >
                    −
                  </Nudge>
                  <input
                    type="number"
                    aria-label={axis === "x" ? "Offset across in pixels" : "Offset down in pixels"}
                    step={0.5}
                    className={`${inputClass} w-20`}
                    value={round(pixels[axis])}
                    onChange={(event) => set({ [axis]: Number(event.target.value) || 0 })}
                  />
                  <Nudge
                    label={`Offset ${axis === "x" ? "right" : "down"}`}
                    onClick={() => set({ [axis]: pixels[axis] + 0.5 })}
                  >
                    +
                  </Nudge>
                </div>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1">
              <span>Lines: {grid.lines === 0 ? "hidden (the image has its own)" : "shown"}</span>
              <input
                type="range"
                aria-label="Line strength"
                min={0}
                max={1}
                step={0.05}
                value={grid.lines}
                onChange={(event) => set({}, Number(event.target.value))}
              />
            </label>
          </>
        )}
      </div>
    </details>
  );
}

function Nudge({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" aria-label={label} className={buttonClass} onClick={onClick}>
      {children}
    </button>
  );
}

const round = (value: number) => Math.round(value * 100) / 100;
