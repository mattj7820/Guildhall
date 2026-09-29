import type { MarkerColour, TokenView } from "~/maps/tokens/types";
import type { Size } from "~/maps/types";
import { toPixels } from "~/maps/geometry";

/** A token's radius on screen, whatever the zoom. */
export const TOKEN_RADIUS = 15;

const CLIP_ID = "token-portrait-clip";

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
  tokens: readonly TokenView[];
  size: Size;
  /** Screen pixels per image pixel. */
  scale: number;
  selectedId?: string;
  /** The DM chooses a token to change it. */
  onSelect?: (token: TokenView) => void;
}

/**
 * Tokens drawn over the map and its fog, the same size on screen at every zoom. Only what the
 * server sent for this viewer is here; the DM's copy says what players can't see.
 */
export function TokenLayer({ tokens, size, scale, selectedId, onSelect }: Props) {
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
          scale={scale}
          selected={token.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
}

function TokenMark({
  token,
  size,
  scale,
  selected,
  onSelect,
}: {
  token: TokenView;
  size: Size;
  scale: number;
  selected: boolean;
  onSelect?: (token: TokenView) => void;
}) {
  const r = TOKEN_RADIUS / scale;
  const [x, y] = toPixels(token.at, size);
  const dim = token.hidden || token.inTheDark;
  const select = onSelect && (() => onSelect(token));

  return (
    <g
      role={select ? "button" : "img"}
      aria-label={tokenLabel(token)}
      aria-pressed={select ? selected : undefined}
      tabIndex={select ? 0 : undefined}
      className={`group outline-none ${select ? "cursor-pointer" : ""}`}
      transform={`translate(${x} ${y})`}
      opacity={dim ? 0.75 : 1}
      onPointerDown={select && ((event) => event.stopPropagation())}
      onClick={
        select &&
        ((event) => {
          event.stopPropagation();
          select();
        })
      }
      onKeyDown={
        select &&
        ((event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          select();
        })
      }
    >
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
      <text
        y={r + 14 / scale}
        textAnchor="middle"
        fontSize={12 / scale}
        strokeWidth={3 / scale}
        className="pointer-events-none fill-stone-900 stroke-white font-semibold select-none [paint-order:stroke]"
      >
        {token.name}
      </text>
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
  return (
    <>
      <circle r={r} className={fill} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r}
        className="pointer-events-none fill-white font-serif font-bold select-none"
      >
        {token.name.charAt(0).toUpperCase()}
      </text>
    </>
  );
}

/** What a screen reader hears, and what tests find a token by. */
export function tokenLabel(token: TokenView): string {
  const where = `at ${percent(token.at[0])}, ${percent(token.at[1])}`;
  const notes = [
    token.hidden === "secret" && "players can't see this",
    token.hidden === "fog" && "under the fog",
    token.inTheDark && "in the dark",
  ].filter(Boolean);
  return [`${token.name} ${where}`, ...notes].join(", ");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
