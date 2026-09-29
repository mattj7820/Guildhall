// PROTOTYPE (removed before the PR): party tokens on a map, dragged live over a websocket, with
// switches for how often a drag is sent, smoothing, and a pretend network delay, to try the feel.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CanvasTools } from "~/components/maps/MapCanvas";
import { MapCanvas } from "~/components/maps/MapCanvas";
import { Tiles } from "~/components/maps/PlayerMapViewer";
import { buttonClass, labelClass, primaryButtonClass } from "~/components/styles";
import { normalise, offset, toPixels } from "~/maps/geometry";
import type { MapView, Point, Size } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import type { ServerMessage } from "~/live/messages";

export interface PrototypeToken {
  id: string;
  name: string;
  portraitUrl?: string;
  movable: boolean;
}

/** Sends per second while dragging; 0 sends only the drop. */
const RATES = [0, 5, 10, 20, 60] as const;
const DELAYS = [0, 100, 250, 500] as const;
/** A token's radius on screen, whatever the zoom. */
const RADIUS = 15;
/** Arrow keys move a token this many screen pixels; Shift, five times as far. */
const KEY_STEP = 10;
/** Keyboard moves count as dropped once the keys have been still this long. */
const KEY_SETTLE_MS = 400;
/** Someone else's drag is forgotten if nothing more is heard for this long. */
const DRAG_STALE_MS = 3000;

interface OtherDrag {
  at: Point;
  by: string;
  seen: number;
}

export function TokensPrototype({ map, tokens }: { map: MapView; tokens: PrototypeToken[] }) {
  const [rate, setRate] = useState<number>(20);
  const [smoothing, setSmoothing] = useState(true);
  const [delay, setDelay] = useState<number>(0);
  const [status, setStatus] = useState<"connecting" | "live" | "gone">("connecting");
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [others, setOthers] = useState<Record<string, OtherDrag>>({});
  const [mine, setMine] = useState<{ id: string; at: Point } | null>(null);
  const [counts, setCounts] = useState({ sent: 0, received: 0 });

  const socket = useRef<WebSocket | null>(null);
  const settings = useRef({ rate, delay });
  useEffect(() => {
    settings.current = { rate, delay };
  });

  // One connection for the page, reopened a moment after it drops.
  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    function open() {
      const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`;
      const ws = new WebSocket(url);
      socket.current = ws;
      setStatus("connecting");
      ws.onopen = () => {
        setStatus("live");
        ws.send(JSON.stringify({ type: "watch", map: map.id }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        setTimeout(() => receive(message), settings.current.delay);
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("connecting");
        retry = setTimeout(open, 2000);
      };
    }
    function receive(message: ServerMessage) {
      setCounts((counts) => ({ ...counts, received: counts.received + 1 }));
      if (message.type === "map") return;
      if (message.type === "gone") return setStatus("gone");
      if (message.type === "drag") {
        setOthers((others) => ({
          ...others,
          [message.token]: { at: message.at, by: message.by, seen: Date.now() },
        }));
        return;
      }
      setPositions(message.positions);
      // A saved position ends everyone else's drag of it.
      setOthers({});
    }
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [map.id]);

  // Forget others' drags that stopped without a drop (a closed tab).
  useEffect(() => {
    const timer = setInterval(() => {
      setOthers((others) => {
        const now = Date.now();
        const kept = Object.entries(others).filter(([, drag]) => now - drag.seen < DRAG_STALE_MS);
        return kept.length === Object.keys(others).length ? others : Object.fromEntries(kept);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function send(message: object) {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    const text = JSON.stringify(message);
    // The pretend delay applies both ways.
    setTimeout(() => ws.send(text), settings.current.delay);
    setCounts((counts) => ({ ...counts, sent: counts.sent + 1 }));
  }

  const [throttle] = useState(() => new Throttle());
  function sendDrag(id: string, at: Point) {
    throttle.push(settings.current.rate, () => send({ type: "drag", map: map.id, token: id, at }));
  }
  function drop(id: string, at: Point) {
    throttle.cancel();
    send({ type: "drop", map: map.id, token: id, at });
    // Stays where it was dropped; the server's answer will say the same.
    setPositions((positions) => ({ ...positions, [id]: at }));
    setMine(null);
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <a href={mapUrl(map.id)} className="font-serif font-bold hover:underline">
          ← {map.name}
        </a>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          Prototype: positions are kept in memory only, and the fog is ignored
        </span>
        <span role="status" aria-label="Connection" className="ml-auto">
          {status === "live" ? "● Live" : status === "gone" ? "Map not found" : "○ Connecting…"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <Choice label="Send while dragging" value={rate} options={RATES} onChange={setRate}>
          {(value) => (value === 0 ? "only on drop" : `${value}/s`)}
        </Choice>
        <Choice label="Pretend delay" value={delay} options={DELAYS} onChange={setDelay}>
          {(value) => `${value} ms`}
        </Choice>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={smoothing}
            onChange={(event) => setSmoothing(event.target.checked)}
          />
          Smooth others' moves
        </label>
        <span className="text-stone-500 tabular-nums">
          sent {counts.sent} · received {counts.received}
        </span>
      </div>
      <MapCanvas
        name={map.name}
        size={map.size}
        imageUrl={map.image.url}
        className="flex-1"
        backdrop={map.image.tiles && <Tiles size={map.size} layer={map.image.tiles} />}
      >
        {(canvas) => (
          <g aria-label="Tokens" role="group">
            <defs>
              <clipPath id="token-clip" clipPathUnits="objectBoundingBox">
                <circle cx={0.5} cy={0.5} r={0.5} />
              </clipPath>
            </defs>
            {tokens.map((token) => {
              const other = others[token.id];
              const dragging = mine?.id === token.id;
              const at = dragging ? mine.at : (other?.at ?? positions[token.id]);
              if (!at) return null;
              return (
                <TokenMark
                  key={token.id}
                  token={token}
                  at={at}
                  size={map.size}
                  canvas={canvas}
                  movedBy={dragging ? undefined : other?.by}
                  smooth={smoothing && !dragging}
                  onDrag={(to) => {
                    setMine({ id: token.id, at: to });
                    sendDrag(token.id, to);
                  }}
                  onDrop={(to) => drop(token.id, to)}
                  onCancel={() => setMine(null)}
                />
              );
            })}
          </g>
        )}
      </MapCanvas>
    </main>
  );
}

/** Sending while dragging: at most `rate` a second, always ending with the latest position. */
class Throttle {
  private last = 0;
  private trailing: ReturnType<typeof setTimeout> | undefined;

  push(rate: number, send: () => void) {
    this.cancel();
    if (rate === 0) return;
    const run = () => {
      this.last = performance.now();
      send();
    };
    const wait = 1000 / rate - (performance.now() - this.last);
    if (wait <= 0) run();
    else this.trailing = setTimeout(run, wait);
  }

  cancel() {
    clearTimeout(this.trailing);
  }
}

function Choice<T extends number>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  children: (value: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className={labelClass}>{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          className={option === value ? primaryButtonClass : buttonClass}
          onClick={() => onChange(option)}
        >
          {children(option)}
        </button>
      ))}
    </div>
  );
}

function TokenMark({
  token,
  at,
  size,
  canvas,
  movedBy,
  smooth,
  onDrag,
  onDrop,
  onCancel,
}: {
  token: PrototypeToken;
  at: Point;
  size: Size;
  canvas: CanvasTools;
  movedBy?: string;
  smooth: boolean;
  onDrag: (at: Point) => void;
  onDrop: (at: Point) => void;
  onCancel: () => void;
}) {
  const press = useRef<{ start: Point; at: Point } | null>(null);
  const keys = useRef<{ at: Point; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const r = RADIUS / canvas.scale;
  const [x, y] = toPixels(at, size);

  const pointerAt = (event: PointerEvent): Point | undefined => {
    const position = canvas.clientToImage(event.clientX, event.clientY);
    return position && normalise(position[0], position[1], size);
  };

  function onKeyDown(event: KeyboardEvent) {
    if (!token.movable) return;
    if (event.key === "Escape" && keys.current) {
      clearTimeout(keys.current.timer);
      keys.current = null;
      return onCancel();
    }
    const step = (event.shiftKey ? KEY_STEP * 5 : KEY_STEP) / canvas.scale;
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
    const from = keys.current?.at ?? at;
    const to = offset(from, move[0], move[1]);
    clearTimeout(keys.current?.timer);
    keys.current = {
      at: to,
      timer: setTimeout(() => {
        keys.current = null;
        onDrop(to);
      }, KEY_SETTLE_MS),
    };
    onDrag(to);
  }

  const label = `${token.name} at ${percent(at[0])}, ${percent(at[1])}${
    token.movable ? ", you can move this" : ""
  }`;

  return (
    <g
      role={token.movable ? "button" : "img"}
      aria-label={label}
      tabIndex={token.movable ? 0 : undefined}
      className={`outline-none ${token.movable ? "cursor-grab active:cursor-grabbing" : ""} group`}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: smooth ? "transform 120ms linear" : "none",
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!token.movable || event.button !== 0) return;
        // Not a pan: the canvas mustn't see this press.
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { start: at, at };
      }}
      onPointerMove={(event) => {
        if (!press.current) return;
        const to = pointerAt(event);
        if (!to) return;
        press.current.at = to;
        onDrag(to);
      }}
      onPointerUp={() => {
        const current = press.current;
        press.current = null;
        if (current && current.at !== current.start) onDrop(current.at);
      }}
      onPointerCancel={() => {
        press.current = null;
        onCancel();
      }}
    >
      <circle
        r={r + 3 / canvas.scale}
        className={
          token.movable
            ? "fill-amber-500 group-focus-visible:fill-sky-500"
            : "fill-stone-100 dark:fill-stone-700"
        }
      />
      {token.portraitUrl ? (
        <image
          href={token.portraitUrl}
          x={-r}
          y={-r}
          width={2 * r}
          height={2 * r}
          clipPath="url(#token-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <>
          <circle r={r} className="fill-stone-700" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={r}
            className="fill-white font-serif font-bold select-none"
          >
            {token.name.charAt(0).toUpperCase()}
          </text>
        </>
      )}
      <text
        y={r + 14 / canvas.scale}
        textAnchor="middle"
        fontSize={12 / canvas.scale}
        strokeWidth={3 / canvas.scale}
        className="pointer-events-none fill-stone-900 stroke-white font-semibold select-none [paint-order:stroke]"
      >
        {movedBy ? `${token.name} (${movedBy})` : token.name}
      </text>
    </g>
  );
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
