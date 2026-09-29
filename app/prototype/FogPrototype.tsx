// PROTOTYPE (removed before the PR): brush, area and rectangle reveals on a coarse mask, the DM's
// see-through fog, and a simulated players' view. Everything lives in this component; nothing is
// saved, and the players' view here is only a black overlay (the real one will be server tiles).
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { MapCanvas } from "~/components/maps/MapCanvas";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import { svgPoints, toPixels } from "~/maps/geometry";
import type { MapView, Point, Size } from "~/maps/types";

const LONG_SIDE_CELLS = 512;
const UNDO_LIMIT = 50;

type Tool = "brush" | "area" | "rect";
type Mode = "reveal" | "hide";

interface Grid {
  cols: number;
  rows: number;
  /** One cell's side in the map's coordinate system (image pixels). */
  cell: number;
}

function gridFor({ width, height }: Size): Grid {
  const cell = Math.max(width, height) / LONG_SIDE_CELLS;
  return { cols: Math.ceil(width / cell), rows: Math.ceil(height / cell), cell };
}

/** Paints every cell whose centre passes the test, looking only inside the bounding box. */
function paintBox(
  cells: Uint8Array,
  grid: Grid,
  box: [number, number, number, number],
  value: number,
  inside: (x: number, y: number) => boolean,
): boolean {
  const [x0, y0, x1, y1] = box;
  const c0 = Math.max(0, Math.floor(x0 / grid.cell));
  const c1 = Math.min(grid.cols - 1, Math.floor(x1 / grid.cell));
  const r0 = Math.max(0, Math.floor(y0 / grid.cell));
  const r1 = Math.min(grid.rows - 1, Math.floor(y1 / grid.cell));
  let changed = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * grid.cols + c;
      if (cells[i] !== value && inside((c + 0.5) * grid.cell, (r + 0.5) * grid.cell)) {
        cells[i] = value;
        changed = true;
      }
    }
  }
  return changed;
}

function segmentDistance(
  px: number,
  py: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function paintStroke(
  cells: Uint8Array,
  grid: Grid,
  points: [number, number][],
  radius: number,
  value: number,
) {
  let changed = false;
  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const box: [number, number, number, number] = [
      Math.min(point[0], previous[0]) - radius,
      Math.min(point[1], previous[1]) - radius,
      Math.max(point[0], previous[0]) + radius,
      Math.max(point[1], previous[1]) + radius,
    ];
    changed =
      paintBox(
        cells,
        grid,
        box,
        value,
        (x, y) => segmentDistance(x, y, previous, point) <= radius,
      ) || changed;
  });
  return changed;
}

function insidePolygon(x: number, y: number, polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function paintPolygon(cells: Uint8Array, grid: Grid, polygon: [number, number][], value: number) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const box: [number, number, number, number] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
  return paintBox(cells, grid, box, value, (x, y) => insidePolygon(x, y, polygon));
}

/** The share of an outline's cells that are revealed (0..1). */
function coverage(cells: Uint8Array, grid: Grid, polygon: [number, number][]) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  let total = 0;
  let revealed = 0;
  paintBox(
    cells,
    grid,
    [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    -1,
    (x, y) => {
      if (insidePolygon(x, y, polygon)) {
        total++;
        const i = Math.floor(y / grid.cell) * grid.cols + Math.floor(x / grid.cell);
        if (cells[i]) revealed++;
      }
      return false;
    },
  );
  return total ? revealed / total : 0;
}

/** The mask as an image: white where the fog is (an SVG mask shows fog there), black where not. */
function maskUrl(cells: Uint8Array, grid: Grid): string {
  const canvas = document.createElement("canvas");
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(grid.cols, grid.rows);
  cells.forEach((revealed, i) => {
    const value = revealed ? 0 : 255;
    pixels.data.set([value, value, value, 255], i * 4);
  });
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

export function FogPrototype({ map }: { map: MapView }) {
  const grid = useMemo(() => gridFor(map.size), [map.size]);
  const [cells, setCells] = useState<Uint8Array>(() => new Uint8Array(grid.cols * grid.rows));
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [baseMode, setBaseMode] = useState<Mode>("reveal");
  const [altHeld, setAltHeld] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [sizePercent, setSizePercent] = useState(3);
  const [playersView, setPlayersView] = useState(false);
  const [softEdges, setSoftEdges] = useState(true);
  const [fogOpacity, setFogOpacity] = useState(0.6);
  const [pointer, setPointer] = useState<[number, number]>();
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const [rectStart, setRectStart] = useState<[number, number] | null>(null);
  const [lastMs, setLastMs] = useState<number>();
  const mode: Mode = altHeld ? (baseMode === "reveal" ? "hide" : "reveal") : baseMode;
  const radius = (Math.max(map.size.width, map.size.height) * sizePercent) / 100;
  // Drawn in the browser only, after hydration, so the server and client render the same.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const url = useMemo(() => (hydrated ? maskUrl(cells, grid) : undefined), [hydrated, cells, grid]);

  const commit = useCallback(
    (paint: (next: Uint8Array) => boolean) => {
      const started = performance.now();
      const next = cells.slice();
      if (!paint(next)) return;
      setUndoStack((stack) => [...stack, cells].slice(-UNDO_LIMIT));
      setRedoStack([]);
      setCells(next);
      setLastMs(performance.now() - started);
    },
    [cells],
  );
  const undo = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, cells]);
    setCells(previous);
  }, [undoStack, cells]);
  const redo = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, cells]);
    setCells(next);
  }, [redoStack, cells]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      setAltHeld(event.altKey);
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        setSpaceHeld(true);
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      const keys: Record<string, () => void> = {
        b: () => setTool("brush"),
        a: () => setTool("area"),
        r: () => setTool("rect"),
        x: () => setBaseMode((current) => (current === "reveal" ? "hide" : "reveal")),
        p: () => setPlayersView((current) => !current),
        "[": () => setSizePercent((current) => Math.max(0.5, +(current / 1.25).toFixed(1))),
        "]": () => setSizePercent((current) => Math.min(15, +(current * 1.25).toFixed(1))),
      };
      keys[event.key]?.();
    };
    const up = (event: KeyboardEvent) => {
      setAltHeld(event.altKey);
      if (event.key === " ") setSpaceHeld(false);
    };
    // Alt alone focuses the browser menu on Windows; keep it for the tool.
    const blockAlt = (event: KeyboardEvent) => event.key === "Alt" && event.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("keyup", blockAlt);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("keyup", blockAlt);
    };
  }, [undo, redo]);

  const areas = map.areas.map((area) => {
    const polygon = area.outline.map((point) => toPixels(point, map.size));
    return { area, polygon, share: coverage(cells, grid, polygon) };
  });
  const value = mode === "reveal" ? 1 : 0;
  const previewColour = mode === "reveal" ? "black" : "white";

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <strong className="mr-2">Fog prototype · {map.name}</strong>
        {(["brush", "area", "rect"] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tool === name}
            className={tool === name ? primaryButtonClass : buttonClass}
            onClick={() => setTool(name)}
          >
            {{ brush: "Brush (B)", area: "Area (A)", rect: "Rectangle (R)" }[name]}
          </button>
        ))}
        <span className="mx-2 h-6 border-l border-stone-300" />
        <button
          type="button"
          className={buttonClass}
          onClick={() => setBaseMode((current) => (current === "reveal" ? "hide" : "reveal"))}
        >
          {mode === "reveal" ? "◐ Revealing" : "◑ Hiding"} (X, or hold Alt)
        </button>
        <label className="flex items-center gap-2">
          Size
          <input
            type="range"
            min={0.5}
            max={15}
            step={0.5}
            value={sizePercent}
            onChange={(event) => setSizePercent(Number(event.target.value))}
          />
          <span className="w-10 tabular-nums">{sizePercent}%</span>
        </label>
        <button
          type="button"
          className={buttonClass}
          onClick={() => commit((next) => (next.fill(1), true))}
        >
          Reveal all
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => commit((next) => (next.fill(0), true))}
        >
          Hide all
        </button>
        <button type="button" className={buttonClass} disabled={!undoStack.length} onClick={undo}>
          ↶ Undo
        </button>
        <button type="button" className={buttonClass} disabled={!redoStack.length} onClick={redo}>
          ↷ Redo
        </button>
        <span className="mx-2 h-6 border-l border-stone-300" />
        <button
          type="button"
          aria-pressed={playersView}
          className={playersView ? primaryButtonClass : buttonClass}
          onClick={() => setPlayersView((current) => !current)}
        >
          Players' view (P)
        </button>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={softEdges}
            onChange={(e) => setSoftEdges(e.target.checked)}
          />
          Soft edges
        </label>
        <label className="flex items-center gap-1">
          DM fog
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={fogOpacity}
            onChange={(event) => setFogOpacity(Number(event.target.value))}
          />
        </label>
        <span className="ml-auto text-xs text-stone-500">
          {grid.cols}×{grid.rows} cells · last paint {lastMs?.toFixed(1) ?? "–"} ms · Space-drag
          pans · wheel zooms
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <MapCanvas name={map.name} size={map.size} imageUrl={map.image.url} className="flex-1">
          {({ clientToImage, scale }) => {
            const at = (event: PointerEvent) => clientToImage(event.clientX, event.clientY);
            const onDown = (event: PointerEvent<SVGRectElement>) => {
              if (spaceHeld || event.button !== 0) return;
              const point = at(event);
              if (!point) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              if (tool === "brush") setStroke([point]);
              if (tool === "rect") setRectStart(point);
            };
            const onMove = (event: PointerEvent<SVGRectElement>) => {
              const point = at(event);
              setPointer(point);
              if (!point) return;
              if (stroke) {
                const last = stroke.at(-1)!;
                // Skip points closer than a cell: they add nothing to the mask.
                if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= grid.cell) {
                  setStroke([...stroke, point]);
                }
              }
            };
            const onUp = () => {
              if (stroke) commit((next) => paintStroke(next, grid, stroke, radius, value));
              if (rectStart && pointer) {
                const [x0, y0] = rectStart;
                const [x1, y1] = pointer;
                commit((next) =>
                  paintPolygon(
                    next,
                    grid,
                    [
                      [x0, y0],
                      [x1, y0],
                      [x1, y1],
                      [x0, y1],
                    ],
                    value,
                  ),
                );
              }
              setStroke(null);
              setRectStart(null);
            };
            const strokePath =
              stroke && stroke.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
            const rectPreview = rectStart &&
              pointer && {
                x: Math.min(rectStart[0], pointer[0]),
                y: Math.min(rectStart[1], pointer[1]),
                width: Math.abs(pointer[0] - rectStart[0]),
                height: Math.abs(pointer[1] - rectStart[1]),
              };
            return (
              <>
                <defs>
                  <mask id="fog-mask" maskUnits="userSpaceOnUse">
                    {url && (
                      <image
                        href={url}
                        width={map.size.width}
                        height={map.size.height}
                        preserveAspectRatio="none"
                        style={{ imageRendering: softEdges ? "auto" : "pixelated" }}
                        filter={softEdges ? "url(#fog-soften)" : undefined}
                      />
                    )}
                    {strokePath && (
                      <path
                        d={strokePath}
                        fill="none"
                        stroke={previewColour}
                        strokeWidth={radius * 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {rectPreview && <rect {...rectPreview} fill={previewColour} />}
                  </mask>
                  <filter id="fog-soften">
                    <feGaussianBlur stdDeviation={grid.cell * 0.6} />
                  </filter>
                </defs>
                <rect
                  width={map.size.width}
                  height={map.size.height}
                  fill="black"
                  opacity={playersView ? 1 : fogOpacity}
                  mask="url(#fog-mask)"
                  pointerEvents="none"
                />
                {areas
                  .filter(({ share }) => !playersView || share >= 0.5)
                  .map(({ area, share }) => (
                    <polygon
                      key={area.id}
                      points={svgPoints(area.outline, map.size)}
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={2}
                      className={
                        share >= 0.5
                          ? "fill-amber-400/10 stroke-amber-600"
                          : "fill-transparent stroke-stone-400 [stroke-dasharray:6_4]"
                      }
                      pointerEvents={tool === "area" && !playersView ? "all" : "none"}
                      style={{ cursor: tool === "area" ? "pointer" : undefined }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() =>
                        commit((next) =>
                          paintPolygon(
                            next,
                            grid,
                            area.outline.map((point: Point) => toPixels(point, map.size)),
                            value,
                          ),
                        )
                      }
                    >
                      <title>{`${area.name}: ${Math.round(share * 100)}% revealed`}</title>
                    </polygon>
                  ))}
                {!playersView && tool !== "area" && (
                  <rect
                    width={map.size.width}
                    height={map.size.height}
                    fill="transparent"
                    pointerEvents={spaceHeld ? "none" : "all"}
                    style={{ cursor: spaceHeld ? "grab" : "crosshair" }}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerLeave={() => setPointer(undefined)}
                  />
                )}
                {!playersView && tool === "brush" && pointer && (
                  <circle
                    cx={pointer[0]}
                    cy={pointer[1]}
                    r={radius}
                    fill="none"
                    stroke={mode === "reveal" ? "#fbbf24" : "#e11d48"}
                    strokeWidth={1.5 / scale}
                    pointerEvents="none"
                  />
                )}
              </>
            );
          }}
        </MapCanvas>
        <aside className="w-64 overflow-y-auto border-l border-stone-200 p-3 text-sm dark:border-stone-800">
          <h2 className="mb-2 font-semibold">Areas (seen by players at ≥ 50%)</h2>
          <ul className="flex flex-col gap-1">
            {areas.map(({ area, share }) => (
              <li key={area.id} className="flex items-center gap-2">
                <span>{share >= 0.5 ? "👁" : "▒"}</span>
                <span className="mr-auto">{area.name}</span>
                <span className="text-xs text-stone-500 tabular-nums">
                  {Math.round(share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
