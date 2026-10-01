// PROTOTYPE (made real before the PR): stunts play on the DM's own screen only, for now.
import { useCallback, useRef, useState } from "react";
import { assetUrl } from "~/wiki/urls";
import type { Point, Size } from "~/maps/types";
import { buttonClass, inputClass } from "~/components/styles";
import type { CanvasTools } from "./MapCanvas";
import { floatingPanelClass, toolButtonClass } from "./MapToolbar";
import type { TokenStunt } from "./TokenLayer";

/** Played at a point (a token's, or anywhere on the map). */
export type PointStuntKind = "impact" | "flash" | "smoke" | "fire" | "number";
/** Played by a token itself. */
export type TokenStuntKind = TokenStunt["kind"];
export type StuntKind = PointStuntKind | TokenStuntKind;

export interface PointStunt {
  kind: PointStuntKind;
  /** Image pixels. */
  at: Point;
  /** Its size in image pixels: about a token's. */
  radius: number;
  text?: string;
  key: number;
}

const POINT_KINDS: { kind: PointStuntKind; label: string }[] = [
  { kind: "impact", label: "Impact" },
  { kind: "flash", label: "Flash" },
  { kind: "smoke", label: "Smoke" },
  { kind: "fire", label: "Fire" },
  { kind: "number", label: "Number" },
];
const TOKEN_KINDS: { kind: TokenStuntKind; label: string }[] = [
  { kind: "hit", label: "Hit" },
  { kind: "glow", label: "Glow" },
  { kind: "fall", label: "Fall" },
];
const isTokenKind = (kind: StuntKind): kind is TokenStuntKind =>
  TOKEN_KINDS.some((each) => each.kind === kind);

/** How long each plays, in milliseconds, before it's tidied away. */
const DURATION: Record<StuntKind, number> = {
  impact: 700,
  flash: 900,
  smoke: 1800,
  fire: 1600,
  number: 1600,
  hit: 600,
  glow: 1400,
  fall: 1200,
};
const SHAKE_MS = 500;

/**
 * The DM's stunts: which one is ready to play, what's playing, and the screen shake. A stunt is
 * armed from the palette and played by the next click on the map or a token.
 */
export function useStunts() {
  const [armed, setArmed] = useState<StuntKind>();
  const [text, setText] = useState("-12");
  const [points, setPoints] = useState<PointStunt[]>([]);
  const [onTokens, setOnTokens] = useState<Record<string, TokenStunt>>({});
  const [shake, setShake] = useState(0);
  const counter = useRef(0);

  const playAt = useCallback((kind: PointStuntKind, at: Point, radius: number, label?: string) => {
    const key = ++counter.current;
    setPoints((current) => [...current, { kind, at, radius, text: label, key }]);
    setTimeout(
      () => setPoints((current) => current.filter((each) => each.key !== key)),
      DURATION[kind],
    );
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
      DURATION[kind],
    );
  }, []);

  /** Plays the armed stunt: at a point, or on a token if it's one a token plays. */
  function play(at: Point, radius: number, token?: string): boolean {
    if (!armed) return false;
    if (isTokenKind(armed)) {
      if (token) playOn(armed, token);
      return !!token;
    }
    playAt(armed, at, radius, armed === "number" ? text : undefined);
    return true;
  }

  function shakeScreen() {
    setShake(++counter.current);
    setTimeout(() => setShake(0), SHAKE_MS);
  }

  return {
    armed,
    setArmed,
    text,
    setText,
    points,
    onTokens,
    shaking: shake !== 0,
    play,
    shakeScreen,
    /** Stands fallen tokens back up. */
    reset: () => setOnTokens({}),
  };
}

export type StuntControls = ReturnType<typeof useStunts>;

/** The stunts and sounds to pick from, over the map's top-right corner. */
export function StuntPalette({
  stunts,
  sounds,
  onClose,
}: {
  stunts: StuntControls;
  sounds: string[];
  onClose: () => void;
}) {
  const choose = (kind: StuntKind) => stunts.setArmed(stunts.armed === kind ? undefined : kind);
  return (
    <div
      role="toolbar"
      aria-label="Stunts"
      className={`${floatingPanelClass} absolute top-3 right-3 z-10 flex w-60 flex-col gap-2 p-2 text-sm`}
    >
      <div className="flex items-center">
        <span className="mr-auto font-semibold">Stunts</span>
        <button type="button" className="text-xs text-stone-500 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-xs text-stone-500">Pick one, then click the map or a token.</p>
      <div className="flex flex-wrap gap-1">
        {POINT_KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={stunts.armed === kind}
            className={`${toolButtonClass(stunts.armed === kind)} text-xs`}
            onClick={() => choose(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      {stunts.armed === "number" && (
        <label className="flex items-center gap-2 text-xs">
          Text
          <input
            value={stunts.text}
            maxLength={12}
            onChange={(event) => stunts.setText(event.target.value)}
            className={`${inputClass} w-24`}
          />
        </label>
      )}
      <span className="text-xs font-semibold text-stone-500">On a token</span>
      <div className="flex flex-wrap gap-1">
        {TOKEN_KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={stunts.armed === kind}
            className={`${toolButtonClass(stunts.armed === kind)} text-xs`}
            onClick={() => choose(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={`${buttonClass} text-xs`} onClick={stunts.shakeScreen}>
          Shake
        </button>
        <button type="button" className={`${buttonClass} text-xs`} onClick={stunts.reset}>
          Stand them up
        </button>
      </div>
      <span className="text-xs font-semibold text-stone-500">Sounds</span>
      {sounds.length === 0 ? (
        <p className="text-xs text-stone-500">Put audio files in the vault's Sounds folder.</p>
      ) : (
        <ul aria-label="Sounds" className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
          {sounds.map((path) => (
            <li key={path}>
              <button
                type="button"
                className="w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800"
                onClick={() => void new Audio(assetUrl(path)).play()}
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

/** "Sounds/Doors/Creak.mp3" → "Doors/Creak". */
export function soundName(path: string): string {
  return path.replace(/^[^/]*\//, "").replace(/\.[^.]+$/, "");
}

/** The point stunts playing now, drawn over the tokens. */
export function StuntLayer({
  stunts,
  canvas,
}: {
  stunts: readonly PointStunt[];
  size: Size;
  canvas: CanvasTools;
}) {
  return (
    <g className="pointer-events-none" aria-hidden="true">
      {stunts.map((stunt) => (
        <g key={stunt.key} transform={`translate(${stunt.at[0]} ${stunt.at[1]})`}>
          <StuntShape stunt={stunt} scale={canvas.scale} />
        </g>
      ))}
    </g>
  );
}

function StuntShape({ stunt, scale }: { stunt: PointStunt; scale: number }) {
  const r = stunt.radius;
  switch (stunt.kind) {
    case "impact":
      return (
        <>
          <circle r={r} className="stunt-ring fill-none stroke-amber-200" strokeWidth={r * 0.25} />
          <circle
            r={r * 0.7}
            className="stunt-ring stunt-late fill-none stroke-orange-500"
            strokeWidth={r * 0.18}
          />
        </>
      );
    case "flash":
      return <circle r={r * 2} className="stunt-flash" fill="url(#stunt-flash)" />;
    case "smoke":
      return (
        <>
          {[-0.5, 0, 0.5].map((dx, index) => (
            <circle
              key={dx}
              cx={dx * r}
              r={r * 0.6}
              className="stunt-smoke fill-stone-400/70"
              style={{ animationDelay: `${index * 150}ms` }}
            />
          ))}
        </>
      );
    case "fire":
      return (
        <>
          <ellipse rx={r * 0.8} ry={r} className="stunt-fire fill-orange-600/80" />
          <ellipse rx={r * 0.5} ry={r * 0.7} className="stunt-fire stunt-late fill-amber-300/90" />
        </>
      );
    case "number":
      return (
        <text
          textAnchor="middle"
          fontSize={22 / scale}
          strokeWidth={4 / scale}
          className="stunt-number fill-rose-600 stroke-white font-serif font-bold [paint-order:stroke]"
        >
          {stunt.text}
        </text>
      );
  }
}

/** Shared by the stunts: the flash's light. */
export function StuntDefs() {
  return (
    <defs>
      <radialGradient id="stunt-flash">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="40%" stopColor="#fef3c7" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
