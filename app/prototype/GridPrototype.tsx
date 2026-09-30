// PROTOTYPE (removed before the PR): a battle grid over a map, with switches for its size,
// offset, line strength, snapping and how tokens are sized, a few local tokens, a ruler and spell
// shapes. Everything lives in this component and nothing is saved; the real geometry will be
// pure, tested modules.
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { MapCanvas, type CanvasTools } from "~/components/maps/MapCanvas";
import { Tiles } from "~/components/maps/PlayerMapViewer";
import { buttonClass, inputClass, labelClass } from "~/components/styles";
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

/** The line's true length at the grid's scale: a square's side is 5 ft. */
function feetAlong(g: Grid, points: Px[]): number {
  let pixels = 0;
  for (let i = 1; i < points.length; i++) {
    pixels += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return (pixels / g.square) * FEET;
}

/** To the nearest half foot, without a trailing ".0". */
const feetLabel = (feet: number) => `${Math.round(feet * 2) / 2} ft`;

/** The grid's scale slider moves in steps like zooming, so small squares are as easy as big. */
const toSlider = (square: number) => Math.log(square);
const fromSlider = (value: number) => Math.round(Math.exp(value) * 2) / 2;

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

  // Space adds a waypoint while measuring; Escape clears what's drawn; V, M and A pick tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement;
      const shortcut = !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
      const tools: Record<string, Tool> = { v: "move", m: "measure", a: "shape" };
      if (shortcut && tools[event.key.toLowerCase()]) {
        const next = tools[event.key.toLowerCase()];
        setTool(next);
        if (next !== tool) {
          setRuler(undefined);
          setShape(undefined);
        }
        return;
      }
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
  }, [ruler, tool]);

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

  const rulerFeet = ruler ? feetAlong(grid, [...ruler.points, ruler.cursor]) : 0;
  const biggestSquare = Math.min(size.width, size.height) / 4;

  /** Changing tool tidies away what the last one drew. */
  function chooseTool(next: Tool) {
    if (next === tool) return;
    setTool(next);
    setRuler(undefined);
    setShape(undefined);
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <a href={`/maps/${map.id}`} className="font-serif font-bold hover:underline">
          ← {map.name}
        </a>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          Prototype: nothing is saved, and the fog is ignored
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1">
          <MapToolbar
            tool={tool}
            onTool={chooseTool}
            shapeKind={shapeKind}
            onShapeKind={(kind) => {
              setShapeKind(kind);
              if (shape) setShape({ ...shape, kind });
            }}
            shapeFeet={shapeFeet}
            onShapeFeet={(feet) => {
              setShapeFeet(feet);
              if (shape) setShape({ ...shape, feet });
            }}
            result={
              tool === "measure" && ruler
                ? feetLabel(rulerFeet)
                : tool === "shape" && shape
                  ? `In the area: ${caught.length > 0 ? caught.map((token) => token.name).join(", ") : "nobody"}`
                  : undefined
            }
          />
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
                    label={feetLabel(rulerFeet)}
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
                      if (tool === "measure")
                        setRuler({ points: [at], cursor: at, dragging: true });
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
        </div>
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-stone-200 p-4 text-sm dark:border-stone-800">
          <section className="flex flex-col gap-2">
            <h2 className={labelClass}>Grid</h2>
            <label className="flex flex-col gap-1">
              <span>
                Grid scale: about {Math.round(size.width / grid.square)} ×{" "}
                {Math.round(size.height / grid.square)} squares
              </span>
              <input
                type="range"
                aria-label="Grid scale"
                min={toSlider(6)}
                max={toSlider(biggestSquare)}
                step={0.005}
                value={toSlider(grid.square)}
                onChange={(event) =>
                  setGrid({ ...grid, square: fromSlider(Number(event.target.value)) })
                }
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Smaller squares"
                className={buttonClass}
                onClick={() => setGrid({ ...grid, square: Math.max(6, grid.square - 0.5) })}
              >
                −
              </button>
              <input
                type="number"
                aria-label="Square size in pixels"
                min={6}
                step={0.5}
                className={`${inputClass} w-24`}
                value={grid.square}
                onChange={(event) =>
                  setGrid({ ...grid, square: Math.max(6, Number(event.target.value) || 6) })
                }
              />
              <button
                type="button"
                aria-label="Bigger squares"
                className={buttonClass}
                onClick={() => setGrid({ ...grid, square: grid.square + 0.5 })}
              >
                +
              </button>
              px a square
            </div>
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

const TOOLS: { tool: Tool; label: string; key: string; icon: string }[] = [
  { tool: "move", label: "Select and move", key: "V", icon: "M5 3l6 17 2.2-7 7-2.2z" },
  {
    tool: "measure",
    label: "Measure",
    key: "M",
    icon: "M3 16.5 16.5 3 21 7.5 7.5 21zM7 12.5l1.8 1.8M10 9.5l1.8 1.8M13 6.5l1.8 1.8",
  },
  {
    tool: "shape",
    label: "Spell area",
    key: "A",
    icon: "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  },
];

const SHAPES: { kind: ShapeKind; icon: string }[] = [
  { kind: "sphere", icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" },
  { kind: "cube", icon: "M5 5h14v14H5z" },
  { kind: "cone", icon: "M4 12 20 4v16z" },
  { kind: "line", icon: "M3 10h18v4H3z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const toolButton = (active: boolean) =>
  `flex size-9 items-center justify-center rounded-md ${
    active
      ? "bg-amber-700 text-white dark:bg-amber-600"
      : "text-stone-700 hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-700"
  }`;

/** The map's tools, over its top-left corner: select, measure, spell area (with its shapes). */
function MapToolbar({
  tool,
  onTool,
  shapeKind,
  onShapeKind,
  shapeFeet,
  onShapeFeet,
  result,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  shapeKind: ShapeKind;
  onShapeKind: (kind: ShapeKind) => void;
  shapeFeet: number;
  onShapeFeet: (feet: number) => void;
  result?: string;
}) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-start gap-2">
      <div
        role="toolbar"
        aria-label="Map tools"
        aria-orientation="vertical"
        className="pointer-events-auto flex flex-col gap-1 rounded-lg bg-white/95 p-1 shadow-md dark:bg-stone-900/95"
      >
        {TOOLS.map((each) => (
          <button
            key={each.tool}
            type="button"
            aria-label={each.label}
            aria-pressed={tool === each.tool}
            aria-keyshortcuts={each.key}
            title={`${each.label} (${each.key})`}
            className={toolButton(tool === each.tool)}
            onClick={() => onTool(each.tool)}
          >
            <Icon d={each.icon} />
          </button>
        ))}
      </div>
      {tool === "shape" && (
        <div
          role="group"
          aria-label="Spell area"
          className="pointer-events-auto flex flex-col gap-1 rounded-lg bg-white/95 p-1 shadow-md dark:bg-stone-900/95"
        >
          <div className="flex gap-1">
            {SHAPES.map(({ kind, icon }) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                aria-pressed={shapeKind === kind}
                title={kind[0].toUpperCase() + kind.slice(1)}
                className={toolButton(shapeKind === kind)}
                onClick={() => onShapeKind(kind)}
              >
                <Icon d={icon} />
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {[10, 15, 20, 30, 60].map((feet) => (
              <button
                key={feet}
                type="button"
                aria-pressed={shapeFeet === feet}
                className={`${toolButton(shapeFeet === feet)} w-auto px-1.5 text-xs font-semibold`}
                onClick={() => onShapeFeet(feet)}
              >
                {feet} ft
              </button>
            ))}
          </div>
        </div>
      )}
      {result && (
        <p
          role="status"
          className="pointer-events-auto rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold shadow-md dark:bg-stone-900/95"
        >
          {result}
        </p>
      )}
    </div>
  );
}
