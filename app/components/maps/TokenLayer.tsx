import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { normalise, offset, toPixels } from "~/maps/geometry";
import {
  snapToGrid,
  toPixels as gridInPixels,
  type MapGrid,
  type PixelGrid,
} from "~/maps/grid/grid";
import type { ShownToken } from "~/maps/tokens/moves";
import type { MarkerColour, TokenView } from "~/maps/tokens/types";
import type { Point, Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

/** A token's radius on screen, whatever the zoom. */
export const TOKEN_RADIUS = 15;

/** Clips a portrait to a circle; badges use it too. */
export const CLIP_ID = "token-portrait-clip";

/** A press becomes a drag once it has moved this many screen pixels; less is a click. */
const DRAG_THRESHOLD = 3;
/** Arrow keys move a token this many screen pixels; with Shift, five times as far. */
const KEY_STEP = 10;
/** Arrow-key moves count as put down once the keys have been still this long. */
const KEY_SETTLE_MS = 400;
/**
 * Others' moves glide between the positions heard (20 a second, or a saved move), rather than
 * jumping; a little longer than the gap between them, so it never stops and starts.
 */
const GLIDE_MS = 80;

/** Moving tokens: they follow the pointer or keys, and are sent when let go. */
export interface TokenMover {
  drag: (id: string, at: Point) => void;
  drop: (id: string, at: Point, from: Point) => void;
  cancel: (id: string) => void;
}

const MARKER_FILLS: Record<MarkerColour, string> = {
  red: "fill-red-600",
  orange: "fill-orange-500",
  yellow: "fill-yellow-400",
  green: "fill-green-600",
  teal: "fill-teal-600",
  blue: "fill-blue-600",
  purple: "fill-purple-600",
  grey: "fill-stone-500",
};

interface Props {
  tokens: readonly ShownToken[];
  size: Size;
  canvas: CanvasTools;
  selectedId?: string;
  /** The DM chooses a token to change it. */
  onSelect?: (token: TokenView) => void;
  /** Moving the tokens this viewer may move. */
  mover?: TokenMover;
  /** Players: say which tokens are theirs to move (the DM may move all of them). */
  sayMovable?: boolean;
  /** The DM may pick up a token someone else is moving; others wait until it's let go. */
  takeHeld?: boolean;
  /** On a battle map, tokens fill their squares, and snap to them if `snap`. */
  grid?: MapGrid;
  snap?: boolean;
  /** In a fight: the token whose turn it is, ringed. */
  activeId?: string;
}

/**
 * Tokens drawn over the map and its fog: the same size on screen at every zoom, or on a battle map
 * filling their squares. Only what the server sent for this viewer is here; the DM's copy says
 * what players can't see.
 */
export function TokenLayer({
  tokens,
  size,
  canvas,
  selectedId,
  onSelect,
  mover,
  sayMovable,
  takeHeld,
  grid,
  snap,
  activeId,
}: Props) {
  const squares = useMemo(() => grid && gridInPixels(grid, size), [grid, size]);
  return (
    <g aria-label="Tokens" role="group">
      <defs>
        <clipPath id={CLIP_ID} clipPathUnits="objectBoundingBox">
          <circle cx={0.5} cy={0.5} r={0.5} />
        </clipPath>
      </defs>
      {tokens.map((token) => (
        <TokenMark
          key={token.id}
          token={token}
          size={size}
          canvas={canvas}
          selected={token.id === selectedId}
          active={token.id === activeId}
          onSelect={onSelect}
          mover={token.movable && (!token.movingBy || takeHeld) ? mover : undefined}
          sayMovable={sayMovable}
          squares={squares}
          snap={!!snap}
        />
      ))}
    </g>
  );
}

function TokenMark({
  token,
  size,
  canvas,
  selected,
  active,
  onSelect,
  mover,
  sayMovable,
  squares,
  snap,
}: {
  token: ShownToken;
  size: Size;
  canvas: CanvasTools;
  selected: boolean;
  active: boolean;
  onSelect?: (token: TokenView) => void;
  mover?: TokenMover;
  sayMovable?: boolean;
  squares?: PixelGrid;
  snap: boolean;
}) {
  const press = useRef<{ x: number; y: number; from: Point; at?: Point } | null>(null);
  const keys = useRef<{ from: Point; at: Point; timer?: ReturnType<typeof setTimeout> } | null>(
    null,
  );
  const { scale } = canvas;
  // Filling its squares (inside its ring, with a little space round it), but never so small on
  // screen it can't be found.
  const r = squares
    ? Math.max((token.size * squares.square) / 2 - 3 / scale - squares.square * 0.04, 6 / scale)
    : TOKEN_RADIUS / scale;

  /** Where a token dropped here settles: on its squares when snapping, unless Alt is held. */
  const settle = (at: Point, free: boolean): Point => {
    if (!squares || !snap || free) return at;
    const [sx, sy] = snapToGrid(squares, toPixels(at, size), token.size);
    return normalise(sx, sy, size);
  };
  const [x, y] = toPixels(token.at, size);
  const dim = token.hidden || token.inTheDark;
  const interactive = !!onSelect || !!mover;

  const pointerAt = (event: PointerEvent): Point | undefined => {
    const position = canvas.clientToImage(event.clientX, event.clientY);
    return position && normalise(position[0], position[1], size);
  };

  function onKeyDown(event: KeyboardEvent) {
    if ((event.key === "Enter" || event.key === " ") && onSelect) {
      event.preventDefault();
      return onSelect(token);
    }
    if (!mover) return;
    if (event.key === "Escape" && keys.current) {
      clearTimeout(keys.current.timer);
      keys.current = null;
      return mover.cancel(token.id);
    }
    // A square at a time when snapping, or a few pixels on screen; Shift goes five times as far.
    const step = (event.shiftKey ? 5 : 1) * (squares && snap ? squares.square : KEY_STEP / scale);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step / size.width, 0],
      ArrowRight: [step / size.width, 0],
      ArrowUp: [0, -step / size.height],
      ArrowDown: [0, step / size.height],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    // The map pans with the arrow keys too; a focused token takes them instead.
    event.stopPropagation();
    const from = keys.current?.from ?? token.at;
    const to = settle(offset(keys.current?.at ?? settle(token.at, false), move[0], move[1]), false);
    clearTimeout(keys.current?.timer);
    keys.current = {
      from,
      at: to,
      timer: setTimeout(() => {
        keys.current = null;
        mover.drop(token.id, to, from);
      }, KEY_SETTLE_MS),
    };
    mover.drag(token.id, to);
  }

  const cursor = mover
    ? "cursor-grab active:cursor-grabbing"
    : token.movingBy && token.movable
      ? "cursor-not-allowed"
      : onSelect
        ? "cursor-pointer"
        : "";
  return (
    <g
      role={interactive ? "button" : "img"}
      aria-label={tokenLabel(token, sayMovable)}
      aria-pressed={onSelect ? selected : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`group outline-none ${cursor}`}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: token.inHand ? "none" : `transform ${GLIDE_MS}ms linear`,
      }}
      opacity={dim ? 0.75 : 1}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerDown={(event) => {
        if (!interactive || event.button !== 0) return;
        // Not a pan: the canvas mustn't see this press.
        event.stopPropagation();
        if (mover) event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { x: event.clientX, y: event.clientY, from: token.at };
      }}
      onPointerMove={(event) => {
        const current = press.current;
        if (!current || !mover) return;
        const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y);
        if (!current.at && distance < DRAG_THRESHOLD) return;
        const pointer = pointerAt(event);
        if (!pointer) return;
        const at = settle(pointer, event.altKey);
        current.at = at;
        mover.drag(token.id, at);
      }}
      onPointerUp={() => {
        const current = press.current;
        press.current = null;
        if (!current) return;
        if (current.at && mover) mover.drop(token.id, current.at, current.from);
        else onSelect?.(token);
      }}
      onPointerCancel={() => {
        if (press.current?.at) mover?.cancel(token.id);
        press.current = null;
      }}
      // A click on a token is never a click on the map (placing, or an area under it).
      onClick={(event) => event.stopPropagation()}
    >
      {active && (
        <circle
          r={r + 8 / scale}
          strokeWidth={5 / scale}
          className="pointer-events-none animate-pulse fill-none stroke-amber-400"
        />
      )}
      <circle
        r={r + 3 / scale}
        strokeWidth={2 / scale}
        strokeDasharray={token.hidden ? `${4 / scale} ${3 / scale}` : undefined}
        className={`${
          selected
            ? "fill-sky-500"
            : token.movable && token.kind === "character"
              ? "fill-amber-500"
              : "fill-white"
        } stroke-stone-900 group-focus-visible:fill-sky-400`}
      />
      <TokenFace token={token} r={r} />
      {token.hp && <HitPointsBar hp={token.hp} r={r} scale={scale} />}
      <text
        y={r + 14 / scale}
        textAnchor="middle"
        fontSize={12 / scale}
        strokeWidth={3 / scale}
        className={`pointer-events-none fill-stone-900 stroke-white font-semibold select-none [paint-order:stroke] ${
          // A battle map is full of tokens: names on hover, and for the ones that matter now.
          squares && !selected && !active && !token.movingBy
            ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            : ""
        }`}
      >
        {token.movingBy ? `${token.name} (${token.movingBy})` : token.name}
      </text>
    </g>
  );
}

/** A monster's hit points, for the DM: a bar over its token, red once it's bloodied. */
function HitPointsBar({
  hp,
  r,
  scale,
}: {
  hp: NonNullable<TokenView["hp"]>;
  r: number;
  scale: number;
}) {
  const width = 1.5 * r;
  const height = 5 / scale;
  const left = Math.max(0, hp.current) / Math.max(1, hp.max);
  return (
    <g
      className="pointer-events-none"
      transform={`translate(${-width / 2} ${-r - 3 / scale - height - 3 / scale})`}
    >
      <rect width={width} height={height} className="fill-stone-900/70" />
      <rect
        width={width * left}
        height={height}
        className={hp.current > hp.max / 2 ? "fill-green-500" : "fill-red-500"}
      />
    </g>
  );
}

function TokenFace({ token, r }: { token: TokenView; r: number }) {
  if (token.portraitUrl) {
    return (
      <image
        href={token.portraitUrl}
        x={-r}
        y={-r}
        width={2 * r}
        height={2 * r}
        clipPath={`url(#${CLIP_ID})`}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }
  const fill = token.colour ? MARKER_FILLS[token.colour] : "fill-stone-700";
  const label = initials(token.name);
  // Smaller for more letters, so "G12" still fits inside.
  const fontSize = r * ([1, 1, 0.75, 0.6][label.length] ?? 0.5);
  return (
    <>
      <circle r={r} className={fill} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        className="pointer-events-none fill-white font-serif font-bold select-none"
      >
        {label}
      </text>
    </>
  );
}

/**
 * What a token without a portrait shows: its first letter, and its number if it has one, so
 * "Goblin 2" and "Goblin 3" can be told apart ("G2", "G3").
 */
export function initials(name: string): string {
  const number = /\s(\d+)$/.exec(name)?.[1];
  const first = name.charAt(0).toUpperCase();
  return number ? `${first}${number}` : first;
}

/** What a screen reader hears, and what tests find a token by. */
export function tokenLabel(token: ShownToken, sayMovable = false): string {
  const where = `at ${percent(token.at[0])}, ${percent(token.at[1])}`;
  const notes = [
    token.hidden === "secret" && "players can't see this",
    token.hidden === "fog" && "under the fog",
    token.inTheDark && "in the dark",
    token.down && "down",
    token.hp && `${token.hp.current} of ${token.hp.max} HP`,
    token.movingBy && `${token.movingBy} is moving it`,
    sayMovable && token.movable && "you can move this",
  ].filter(Boolean);
  return [`${token.name} ${where}`, ...notes].join(", ");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
