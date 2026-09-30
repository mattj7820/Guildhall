// PROTOTYPE (removed before the PR): a battle grid over a map, with switches for its size,
// offset, line strength, snapping and how tokens are sized, a few local tokens, a ruler and spell
// shapes. Everything lives in this component and nothing is saved; the real geometry will be
// pure, tested modules.
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { MapCanvas, type CanvasTools } from "~/components/maps/MapCanvas";
import { Tiles } from "~/components/maps/PlayerMapViewer";
import { buttonClass, inputClass, labelClass, primaryButtonClass } from "~/components/styles";
import type { MapView, Size } from "~/maps/types";

type Px = [number, number];

interface Grid {
  /** A square's side, in image pixels. */
  square: number;
  ox: number;
  oy: number;
}

/** Dungeondraft's default first, then other common exports. */
const COMMON_SQUARES = [256, 200, 140, 128, 100, 70];
const FEET = 5;

function suggestSquare({ width, height }: Size): number | undefined {
  // At least 10 squares along the longer side: fewer isn't a battle map.
  return COMMON_SQUARES.find(
    (side) => width % side === 0 && height % side === 0 && Math.max(width, height) / side >= 10,
  );
}

const colOf = (g: Grid, x: number) => Math.floor((x - g.ox) / g.square);
const rowOf = (g: Grid, y: number) => Math.floor((y - g.oy) / g.square);
const centreOf = (g: Grid, c: number, r: number): Px => [
  g.ox + (c + 0.5) * g.square,
  g.oy + (r + 0.5) * g.square,
];

/** Odd sizes sit in a square; even sizes (Large) on a grid corner. */
function snap(g: Grid, [x, y]: Px, size: number): Px {
  if (size % 2 === 1) return centreOf(g, colOf(g, x), rowOf(g, y));
  return [
    g.ox + Math.round((x - g.ox) / g.square) * g.square,
    g.oy + Math.round((y - g.oy) / g.square) * g.square,
  ];
}

const corner = (g: Grid, [x, y]: Px): Px => snap(g, [x, y], 2);

/** 5e: every square counts 5 ft, diagonals too, so it's the larger of the two gaps. */
function squaresBetween(g: Grid, a: Px, b: Px): number {
  return Math.max(
    Math.abs(colOf(g, a[0]) - colOf(g, b[0])),
    Math.abs(rowOf(g, a[1]) - rowOf(g, b[1])),
  );
}

type ShapeKind = "sphere" | "cube" | "cone" | "line";

interface Shape {
  kind: ShapeKind;
  feet: number;
  origin: Px;
  target: Px;
}

/** Whether an image point is inside the shape. */
function insideShape(g: Grid, shape: Shape, [px, py]: Px): boolean {
  const length = (shape.feet / FEET) * g.square;
  const [ox, oy] = shape.origin;
  const dx = shape.target[0] - ox;
  const dy = shape.target[1] - oy;
  const aim = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / aim, dy / aim];
  const along = (px - ox) * ux + (py - oy) * uy;
  const across = Math.abs(-(px - ox) * uy + (py - oy) * ux);
  switch (shape.kind) {
    case "sphere":
      return Math.hypot(px - ox, py - oy) <= length;
    case "cone":
      // As wide as it is far.
      return along >= 0 && along <= length && across <= along / 2;
    case "line":
      return along >= 0 && along <= length && across <= g.square / 2;
    case "cube": {
      // One face centred on the origin, extending the way it's aimed, square to the grid.
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const sign = horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
      const [a, b] = horizontal ? [px - ox, py - oy] : [py - oy, px - ox];
      return a * sign >= 0 && a * sign <= length && Math.abs(b) <= length / 2;
    }
  }
}

function shapeOutline(g: Grid, shape: Shape): string {
  const length = (shape.feet / FEET) * g.square;
  const [ox, oy] = shape.origin;
  const angle = Math.atan2(shape.target[1] - oy, shape.target[0] - ox);
  const at = (distance: number, turn: number): string =>
    `${ox + Math.cos(angle + turn) * distance},${oy + Math.sin(angle + turn) * distance}`;
  switch (shape.kind) {
    case "sphere":
      return "";
    case "cone": {
      const side = Math.hypot(length, length / 2);
      const half = Math.atan(0.5);
      return `M${ox},${oy} L${at(side, -half)} L${at(side, half)} Z`;
    }
    case "line": {
      const w = g.square / 2;
      const perp = angle + Math.PI / 2;
      const off = (x: number, y: number, d: number) =>
        `${x + Math.cos(perp) * d},${y + Math.sin(perp) * d}`;
      const [ex, ey] = [ox + Math.cos(angle) * length, oy + Math.sin(angle) * length];
      return `M${off(ox, oy, w)} L${off(ex, ey, w)} L${off(ex, ey, -w)} L${off(ox, oy, -w)} Z`;
    }
    case "cube": {
      const dx = shape.target[0] - ox;
      const dy = shape.target[1] - oy;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const sign = horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
      const x = horizontal ? (sign > 0 ? ox : ox - length) : ox - length / 2;
      const y = horizontal ? oy - length / 2 : sign > 0 ? oy : oy - length;
      return `M${x},${y} h${length} v${length} h${-length} Z`;
    }
  }
}

interface LocalToken {
  id: string;
  name: string;
  size: number;
  at: Px;
}

type Tool = "move" | "measure" | "shape";

export function GridPrototype({ map }: { map: MapView }) {
  const size = map.size;
  const suggested = suggestSquare(size);
  const [grid, setGrid] = useState<Grid>({
    square: suggested ?? Math.round(Math.min(size.width, size.height) / 12),
    ox: 0,
    oy: 0,
  });
  const [strength, setStrength] = useState(0.35);
  const [snapping, setSnapping] = useState(true);
  const [scaleWithMap, setScaleWithMap] = useState(true);
  const [tool, setTool] = useState<Tool>("move");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("sphere");
  const [shapeFeet, setShapeFeet] = useState(20);
  const [tokens, setTokens] = useState<LocalToken[]>(() => {
    const [cx, cy] = [size.width / 2, size.height / 2];
    return [
      { id: "a", name: "Medium", size: 1, at: [cx - grid.square * 2, cy] },
      { id: "b", name: "Large", size: 2, at: [cx, cy] },
      { id: "c", name: "Huge", size: 3, at: [cx + grid.square * 3, cy] },
    ];
  });
  const [ruler, setRuler] = useState<{ points: Px[]; cursor: Px; dragging: boolean }>();
  const [shape, setShape] = useState<Shape & { dragging: boolean }>();

  // Space adds a waypoint while measuring; Escape clears what's drawn.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRuler(undefined);
        setShape(undefined);
      }
      if (event.key === " " && ruler?.dragging) {
        event.preventDefault();
        setRuler({ ...ruler, points: [...ruler.points, ruler.cursor] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ruler]);

  const covered = useMemo(() => {
    if (!shape) return [];
    const cells: [number, number][] = [];
    const reach = (shape.feet / FEET) * grid.square * 1.5 + grid.square;
    const [c0, c1] = [colOf(grid, shape.origin[0] - reach), colOf(grid, shape.origin[0] + reach)];
    const [r0, r1] = [rowOf(grid, shape.origin[1] - reach), rowOf(grid, shape.origin[1] + reach)];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (insideShape(grid, shape, centreOf(grid, c, r))) cells.push([c, r]);
      }
    }
    return cells;
  }, [shape, grid]);

  const caught = tokens.filter((token) => {
    const first = [
      colOf(grid, token.at[0] - ((token.size - 1) * grid.square) / 2),
      rowOf(grid, token.at[1] - ((token.size - 1) * grid.square) / 2),
    ];
    return covered.some(
      ([c, r]) =>
        c >= first[0] && c < first[0] + token.size && r >= first[1] && r < first[1] + token.size,
    );
  });

  const rulerSquares = ruler
    ? [...ruler.points, ruler.cursor].reduce(
        (sum, point, index, all) =>
          index === 0 ? 0 : sum + squaresBetween(grid, all[index - 1], point),
        0,
      )
    : 0;

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <a href={`/maps/${map.id}`} className="font-serif font-bold hover:underline">
          ← {map.name}
        </a>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          Prototype: nothing is saved, and the fog is ignored
        </span>
        <div role="group" aria-label="Tool" className="ml-auto flex gap-1">
          {(["move", "measure", "shape"] as const).map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={tool === each}
              className={tool === each ? primaryButtonClass : buttonClass}
              onClick={() => setTool(each)}
            >
              {each === "move" ? "Move tokens" : each === "measure" ? "Measure" : "Spell shape"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <MapCanvas
          name={map.name}
          size={size}
          imageUrl={map.image.url}
          className="flex-1"
          backdrop={map.image.tiles && <Tiles size={size} layer={map.image.tiles} />}
        >
          {(canvas) => (
            <>
              <GridLines grid={grid} size={size} strength={strength} />
              {shape && (
                <g className="pointer-events-none">
                  {covered.map(([c, r]) => (
                    <rect
                      key={`${c}-${r}`}
                      x={grid.ox + c * grid.square}
                      y={grid.oy + r * grid.square}
                      width={grid.square}
                      height={grid.square}
                      className="fill-rose-500/30"
                    />
                  ))}
                  {shape.kind === "sphere" ? (
                    <circle
                      cx={shape.origin[0]}
                      cy={shape.origin[1]}
                      r={(shape.feet / FEET) * grid.square}
                      className="fill-none stroke-rose-600"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <path
                      d={shapeOutline(grid, shape)}
                      className="fill-none stroke-rose-600"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              )}
              {tokens.map((token) => (
                <Token
                  key={token.id}
                  token={token}
                  grid={grid}
                  canvas={canvas}
                  scaleWithMap={scaleWithMap}
                  movable={tool === "move"}
                  onMove={(at, free) =>
                    setTokens((all) =>
                      all.map((each) =>
                        each.id === token.id
                          ? { ...each, at: snapping && !free ? snap(grid, at, each.size) : at }
                          : each,
                      ),
                    )
                  }
                />
              ))}
              {ruler && (
                <Ruler
                  points={[...ruler.points, ruler.cursor]}
                  scale={canvas.scale}
                  label={`${rulerSquares * FEET} ft · ${rulerSquares} squares`}
                />
              )}
              {tool !== "move" && (
                <rect
                  {...size}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerDown={(event: PointerEvent<SVGRectElement>) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const at = canvas.clientToImage(event.clientX, event.clientY);
                    if (!at) return;
                    if (tool === "measure") setRuler({ points: [at], cursor: at, dragging: true });
                    else {
                      const origin = snapping ? corner(grid, at) : at;
                      setShape({
                        kind: shapeKind,
                        feet: shapeFeet,
                        origin,
                        target: at,
                        dragging: true,
                      });
                    }
                  }}
                  onPointerMove={(event) => {
                    const at = canvas.clientToImage(event.clientX, event.clientY);
                    if (!at) return;
                    if (ruler?.dragging) setRuler({ ...ruler, cursor: at });
                    if (shape?.dragging) setShape({ ...shape, target: at });
                  }}
                  onPointerUp={() => {
                    if (ruler?.dragging) setRuler({ ...ruler, dragging: false });
                    if (shape?.dragging) setShape({ ...shape, dragging: false });
                  }}
                />
              )}
            </>
          )}
        </MapCanvas>
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-stone-200 p-4 text-sm dark:border-stone-800">
          <section className="flex flex-col gap-2">
            <h2 className={labelClass}>Grid</h2>
            <label className="flex items-center gap-2">
              Square
              <input
                type="number"
                min={10}
                className={`${inputClass} w-24`}
                value={grid.square}
                onChange={(event) =>
                  setGrid({ ...grid, square: Math.max(10, Number(event.target.value) || 10) })
                }
              />
              px
            </label>
            <p className="text-stone-500">
              {suggested
                ? `Suggested: ${suggested} px (${size.width / suggested} × ${size.height / suggested} squares)`
                : "No common square size fits this image evenly."}{" "}
              {suggested && suggested !== grid.square && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setGrid({ square: suggested, ox: 0, oy: 0 })}
                >
                  Use it
                </button>
              )}
            </p>
            <label className="flex items-center gap-2">
              Offset
              <input
                type="number"
                className={`${inputClass} w-20`}
                value={grid.ox}
                onChange={(event) => setGrid({ ...grid, ox: Number(event.target.value) || 0 })}
              />
              <input
                type="number"
                className={`${inputClass} w-20`}
                value={grid.oy}
                onChange={(event) => setGrid({ ...grid, oy: Number(event.target.value) || 0 })}
              />
            </label>
            <label className="flex items-center gap-2">
              Line strength
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={strength}
                onChange={(event) => setStrength(Number(event.target.value))}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapping}
                onChange={(event) => setSnapping(event.target.checked)}
              />
              Snap to the grid (hold Alt to place freely)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scaleWithMap}
                onChange={(event) => setScaleWithMap(event.target.checked)}
              />
              Tokens fill their squares (else fixed on screen)
            </label>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className={labelClass}>Spell shape</h2>
            <div className="flex flex-wrap gap-1">
              {(["sphere", "cube", "cone", "line"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={shapeKind === kind}
                  className={`${shapeKind === kind ? primaryButtonClass : buttonClass} capitalize`}
                  onClick={() => {
                    setShapeKind(kind);
                    setTool("shape");
                    if (shape) setShape({ ...shape, kind });
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[10, 15, 20, 30, 60].map((feet) => (
                <button
                  key={feet}
                  type="button"
                  aria-pressed={shapeFeet === feet}
                  className={shapeFeet === feet ? primaryButtonClass : buttonClass}
                  onClick={() => {
                    setShapeFeet(feet);
                    if (shape) setShape({ ...shape, feet });
                  }}
                >
                  {feet} ft
                </button>
              ))}
            </div>
            <p className="text-stone-500">
              Click to place it (on a grid corner when snapping), drag to aim. Escape clears.
            </p>
            {shape && (
              <p>
                In the area:{" "}
                {caught.length > 0 ? caught.map((token) => token.name).join(", ") : "nobody"} (
                {covered.length} squares)
              </p>
            )}
          </section>
          <section className="flex flex-col gap-1">
            <h2 className={labelClass}>Measure</h2>
            <p className="text-stone-500">
              Drag to measure; press Space while dragging to add a turn. Escape clears.
            </p>
            {ruler && <p>{`${rulerSquares * FEET} ft (${rulerSquares} squares)`}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}

function GridLines({ grid, size, strength }: { grid: Grid; size: Size; strength: number }) {
  const d = useMemo(() => {
    const parts: string[] = [];
    const start = (offset: number) => ((offset % grid.square) + grid.square) % grid.square;
    for (let x = start(grid.ox); x <= size.width; x += grid.square)
      parts.push(`M${x},0V${size.height}`);
    for (let y = start(grid.oy); y <= size.height; y += grid.square)
      parts.push(`M0,${y}H${size.width}`);
    return parts.join("");
  }, [grid, size]);
  return (
    <path
      d={d}
      className="pointer-events-none stroke-stone-950"
      strokeOpacity={strength}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Token({
  token,
  grid,
  canvas,
  scaleWithMap,
  movable,
  onMove,
}: {
  token: LocalToken;
  grid: Grid;
  canvas: CanvasTools;
  scaleWithMap: boolean;
  movable: boolean;
  onMove: (at: Px, free: boolean) => void;
}) {
  const [drag, setDrag] = useState<Px>();
  // Filling its squares, but never smaller than 12 pixels across on screen.
  const r = scaleWithMap
    ? Math.max((token.size * grid.square) / 2 - grid.square * 0.06, 6 / canvas.scale)
    : 15 / canvas.scale;
  const [x, y] = drag ?? token.at;
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={movable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}
      onPointerDown={(event) => {
        if (!movable || event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag(token.at);
      }}
      onPointerMove={(event) => {
        if (!drag) return;
        const at = canvas.clientToImage(event.clientX, event.clientY);
        if (at) setDrag(at);
      }}
      onPointerUp={(event) => {
        if (drag) onMove(drag, event.altKey);
        setDrag(undefined);
      }}
    >
      <circle
        r={r}
        className="fill-amber-500 stroke-stone-900"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle r={r * 0.82} className="fill-stone-700" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 0.9}
        className="fill-white font-serif font-bold select-none"
      >
        {token.name.charAt(0)}
      </text>
      <text
        y={r + 12 / canvas.scale}
        textAnchor="middle"
        fontSize={12 / canvas.scale}
        strokeWidth={3 / canvas.scale}
        className="pointer-events-none fill-stone-900 stroke-white font-semibold select-none [paint-order:stroke]"
      >
        {token.name}
      </text>
    </g>
  );
}

function Ruler({ points, scale, label }: { points: Px[]; scale: number; label: string }) {
  const end = points[points.length - 1];
  return (
    <g className="pointer-events-none">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        className="fill-none stroke-sky-600"
        strokeWidth={3}
        strokeDasharray="8 5"
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={4 / scale} className="fill-sky-600" />
      ))}
      <text
        x={end[0] + 10 / scale}
        y={end[1] - 10 / scale}
        fontSize={15 / scale}
        strokeWidth={4 / scale}
        className="fill-sky-900 stroke-white font-bold [paint-order:stroke]"
      >
        {label}
      </text>
    </g>
  );
}
