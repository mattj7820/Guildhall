import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveMap } from "~/live/useLive";
import { normalise } from "~/maps/geometry";
import {
  isTokenStunt,
  POINT_STUNTS,
  type PointStuntKind as SentPointKind,
  type Stunt,
  type StuntEvent,
  type TokenStuntKind,
} from "~/maps/stunts";
import { mapStuntsUrl, soundUrl } from "~/maps/urls";
import type { MapId, Point, Size } from "~/maps/types";
import { newId } from "~/shared/ids";
import { buttonClass } from "~/components/styles";
import type { CanvasTools } from "./MapCanvas";
import { floatingPanelClass, toolButtonClass } from "./MapToolbar";
import type { TokenStunt } from "./TokenLayer";

/** Drawn at a point: the stunts played there, and "light", a glowing token's light. */
export type PointStuntKind = SentPointKind | "light";
export type StuntKind = PointStuntKind | TokenStuntKind;

export interface PointStunt {
  kind: PointStuntKind;
  /** Image pixels. */
  at: Point;
  /** Its radius in image pixels. */
  radius: number;
  key: number;
}

const POINT_KINDS: { kind: SentPointKind; label: string }[] = [
  { kind: "impact", label: "Impact" },
  { kind: "flash", label: "Flash" },
  { kind: "smoke", label: "Smoke" },
];
const TOKEN_KINDS: { kind: TokenStuntKind; label: string }[] = [
  { kind: "wobble", label: "Wobble" },
  { kind: "glow", label: "Glow" },
  { kind: "fall", label: "Fall" },
];
const isPointKind = (kind: StuntKind): kind is SentPointKind =>
  (POINT_STUNTS as readonly string[]).includes(kind);

/**
 * How long each plays, in milliseconds, before it's tidied away: long enough for the table to
 * take it in. The animations in app.css are timed to fit.
 */
export const STUNT_MS: Record<StuntKind, number> = {
  impact: 3200,
  flash: 3000,
  smoke: 5600,
  light: 5000,
  wobble: 1300,
  glow: 5000,
  fall: 1200,
};
const SHAKE_MS = 500;
/** The whole map flashing white, for the flash. */
const FLASH_MS = 1400;

/**
 * Stunts on a map: what's playing, the shake and the flash, for everyone watching it. Stunts come
 * over the live connection; the DM's own are played at once and sent (`send`), with an ID so the
 * tab doesn't play them twice when they come back. `tokenAt` says where a token is now (image
 * pixels), for a glow's light.
 */
export function useStunts(
  map: { id: MapId; size: Size },
  tokenAt: (token: string) => Point | undefined,
) {
  const [points, setPoints] = useState<PointStunt[]>([]);
  const [onTokens, setOnTokens] = useState<Record<string, TokenStunt>>({});
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const counter = useRef(0);
  const mine = useRef(new Set<string>());
  const where = useRef(tokenAt);
  useEffect(() => {
    where.current = tokenAt;
  });

  const playAt = useCallback((kind: PointStuntKind, at: Point, radius: number) => {
    const key = ++counter.current;
    setPoints((current) => [...current, { kind, at, radius, key }]);
    setTimeout(
      () => setPoints((current) => current.filter((each) => each.key !== key)),
      STUNT_MS[kind],
    );
    if (kind === "flash") {
      setFlash(key);
      setTimeout(() => setFlash((current) => (current === key ? 0 : current)), FLASH_MS);
    }
  }, []);

  const playOn = useCallback((kind: TokenStuntKind, token: string) => {
    const key = ++counter.current;
    setOnTokens((current) => ({ ...current, [token]: { kind, key } }));
    // A fallen token stays down until something else happens to it.
    if (kind === "fall") return;
    setTimeout(
      () =>
        setOnTokens((current) => {
          if (current[token]?.key !== key) return current;
          const rest = { ...current };
          delete rest[token];
          return rest;
        }),
      STUNT_MS[kind],
    );
  }, []);

  const show = useCallback(
    (stunt: Stunt) => {
      const { width, height } = map.size;
      if (isTokenStunt(stunt)) {
        playOn(stunt.kind, stunt.token);
        const at = where.current(stunt.token);
        if (stunt.kind === "glow" && stunt.light && at) playAt("light", at, stunt.light * width);
        return;
      }
      switch (stunt.kind) {
        case "shake":
          setShake(++counter.current);
          setTimeout(() => setShake(0), SHAKE_MS);
          return;
        case "stand":
          return setOnTokens({});
        case "sound":
          void new Audio(soundUrl(stunt.sound)).play().catch(() => {});
          return;
        default:
          playAt(stunt.kind, [stunt.at[0] * width, stunt.at[1] * height], stunt.size * width);
      }
    },
    [map.size, playAt, playOn],
  );

  useLiveMap(map.id, (message) => {
    if (message.type !== "stunt" || mine.current.delete(message.stunt.id)) return;
    show(message.stunt);
  });

  /** The DM plays a stunt: here at once, and for everyone else over the live connection. */
  const send = useCallback(
    (stunt: Stunt) => {
      const event = { ...stunt, id: newId() } as StuntEvent;
      mine.current.add(event.id);
      show(stunt);
      void fetch(mapStuntsUrl(map.id), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ stunt: event }),
      }).catch(() => {});
    },
    [map.id, show],
  );

  return {
    points,
    onTokens,
    shaking: shake !== 0,
    /** Changes with each flash, so the overlay plays again. */
    flashKey: flash,
    send,
  };
}

export type Stunts = ReturnType<typeof useStunts>;

/**
 * The DM's choice of stunt, armed from the palette and played by the next click on the map or a
 * token. `sizes` are in image pixels: a burst's radius (a few squares) and a glow's light (five).
 */
export function useStuntPicker(stunts: Stunts, size: Size) {
  const [armed, setArmed] = useState<StuntKind>();
  function play(at: Point, sizes: { burst: number; light: number }, token?: string): boolean {
    if (!armed || armed === "light") return false;
    if (isPointKind(armed)) {
      stunts.send({
        kind: armed,
        at: normalise(at[0], at[1], size),
        size: Math.min(1, sizes.burst / size.width),
      });
      return true;
    }
    if (!token) return false;
    stunts.send({
      kind: armed,
      token,
      ...(armed === "glow" && { light: Math.min(1, sizes.light / size.width) }),
    });
    return true;
  }
  return {
    armed,
    setArmed,
    play,
    shakeScreen: () => stunts.send({ kind: "shake" }),
    standUp: () => stunts.send({ kind: "stand" }),
    playSound: (sound: string) => stunts.send({ kind: "sound", sound }),
  };
}

export type StuntPicker = ReturnType<typeof useStuntPicker>;

/** The stunts and sounds to pick from, over the map's top-right corner. */
export function StuntPalette({
  stunts,
  sounds,
  onClose,
}: {
  stunts: StuntPicker;
  sounds: string[];
  onClose: () => void;
}) {
  const choose = (kind: StuntKind) => stunts.setArmed(stunts.armed === kind ? undefined : kind);
  const button = ({ kind, label }: { kind: StuntKind; label: string }) => (
    <button
      key={kind}
      type="button"
      aria-pressed={stunts.armed === kind}
      className={`${toolButtonClass(stunts.armed === kind)} text-xs`}
      onClick={() => choose(kind)}
    >
      {label}
    </button>
  );
  return (
    <div
      role="toolbar"
      aria-label="Stunts"
      className={`${floatingPanelClass} absolute top-3 right-3 z-10 flex w-56 flex-col gap-2 p-2 text-sm`}
    >
      <div className="flex items-center">
        <span className="mr-auto font-semibold">Stunts</span>
        <button type="button" className="text-xs text-stone-500 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-xs text-stone-500">Pick one, then click the map or a token.</p>
      <div className="flex flex-wrap gap-1">
        {POINT_KINDS.map(button)}
        <button type="button" className={`${buttonClass} text-xs`} onClick={stunts.shakeScreen}>
          Shake
        </button>
      </div>
      <span className="text-xs font-semibold text-stone-500">On a token</span>
      <div className="flex flex-wrap gap-1">
        {TOKEN_KINDS.map(button)}
        <button type="button" className={`${buttonClass} text-xs`} onClick={stunts.standUp}>
          Stand them up
        </button>
      </div>
      <span className="text-xs font-semibold text-stone-500">Sounds</span>
      {sounds.length === 0 ? (
        <p className="text-xs text-stone-500">
          Put audio files in the vault's sounds folder (Sounds, unless set otherwise).
        </p>
      ) : (
        <ul aria-label="Sounds" className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
          {sounds.map((path) => (
            <li key={path}>
              <button
                type="button"
                className="w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800"
                onClick={() => stunts.playSound(path)}
              >
                ▶ {soundName(path)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Doors/Creak.mp3" → "Doors/Creak". */
export function soundName(path: string): string {
  return path.replace(/\.[^.]+$/, "");
}

/** The whole map flashing white, over everything, for the flash. */
export function FlashOverlay({ flashKey }: { flashKey: number }) {
  if (!flashKey) return null;
  return (
    <div
      key={flashKey}
      aria-hidden="true"
      className="stunt-screen-flash pointer-events-none absolute inset-0 z-[5] bg-white"
    />
  );
}

/**
 * The point stunts playing now. `under` is the light round a glowing token, drawn beneath the
 * tokens so they stay clear in it; everything else is drawn over them.
 */
export function StuntLayer({
  stunts,
  under = false,
}: {
  stunts: readonly PointStunt[];
  size: Size;
  canvas: CanvasTools;
  under?: boolean;
}) {
  return (
    <g className="pointer-events-none" aria-hidden="true">
      {stunts
        .filter((stunt) => (stunt.kind === "light") === under)
        .map((stunt) => (
          <g
            key={stunt.key}
            data-stunt={stunt.kind}
            transform={`translate(${stunt.at[0]} ${stunt.at[1]})`}
          >
            <StuntShape stunt={stunt} />
          </g>
        ))}
    </g>
  );
}

/** Spread evenly round a circle, so the debris and smoke look scattered but never clump. */
const around = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (index % 2) * 0.3;
    return { index, dx: Math.cos(angle), dy: Math.sin(angle), wobble: ((index * 37) % 10) / 10 };
  });

function StuntShape({ stunt }: { stunt: PointStunt }) {
  const r = stunt.radius;
  switch (stunt.kind) {
    case "impact":
      return (
        <>
          {/* Scorched ground, left behind for a moment. */}
          <circle r={r * 0.55} className="stunt-scorch" fill="url(#stunt-scorch)" />
          <circle r={r * 0.9} className="stunt-core" fill="url(#stunt-fire-core)" />
          {[0, 1, 2].map((wave) => (
            <circle
              key={wave}
              r={r}
              className="stunt-ring fill-none stroke-amber-100"
              strokeWidth={r * (0.12 - wave * 0.03)}
              style={{ animationDelay: `${wave * 260}ms` }}
            />
          ))}
          {around(14).map(({ index, dx, dy, wobble }) => (
            <circle
              key={index}
              r={r * (0.04 + wobble * 0.04)}
              className="stunt-debris fill-stone-800"
              style={
                {
                  "--to-x": `${dx * r * (1.2 + wobble)}px`,
                  "--to-y": `${dy * r * (1.2 + wobble)}px`,
                  animationDelay: `${wobble * 120}ms`,
                } as CSSProperties
              }
            />
          ))}
        </>
      );
    case "flash":
      return <circle r={r * 2.5} className="stunt-flash" fill="url(#stunt-flash)" />;
    case "light":
      return <circle r={r} className="stunt-light" fill="url(#stunt-light)" />;
    case "smoke":
      return (
        <g filter="url(#stunt-soft)">
          {[{ index: -1, dx: 0, dy: 0, wobble: 0.5 }, ...around(9)].map(
            ({ index, dx, dy, wobble }) => (
              <circle
                key={index}
                cx={dx * r * 0.55}
                cy={dy * r * 0.45}
                r={r * (0.5 + wobble * 0.35)}
                className={`stunt-smoke ${index % 2 ? "fill-stone-500/80" : "fill-stone-300/80"}`}
                style={{ animationDelay: `${(index + 1) * 90}ms` }}
              />
            ),
          )}
        </g>
      );
  }
}

/** Shared by the stunts: gradients and the smoke's softness. */
export function StuntDefs() {
  return (
    <defs>
      <radialGradient id="stunt-flash">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="35%" stopColor="#fffbeb" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="stunt-light">
        <stop offset="0%" stopColor="#f0fdf4" stopOpacity="0.95" />
        <stop offset="30%" stopColor="#bbf7d0" stopOpacity="0.7" />
        <stop offset="70%" stopColor="#4ade80" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="stunt-fire-core">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="30%" stopColor="#fde68a" stopOpacity="0.95" />
        <stop offset="65%" stopColor="#f97316" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="stunt-scorch">
        <stop offset="0%" stopColor="#1c1917" stopOpacity="0.8" />
        <stop offset="70%" stopColor="#292524" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#292524" stopOpacity="0" />
      </radialGradient>
      {/* In the cloud's own proportions, so it's as soft at any size. */}
      <filter
        id="stunt-soft"
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
        primitiveUnits="objectBoundingBox"
      >
        <feGaussianBlur stdDeviation="0.03" />
      </filter>
    </defs>
  );
}
