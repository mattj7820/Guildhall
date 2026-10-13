/**
 * PROTOTYPE (deleted once a style is chosen): areas on a map drawn in several styles, to try the
 * feel. Content over map art keeps fixed colours in every theme.
 */
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Link } from "react-router";
import { AreaShape } from "~/components/maps/AreaShape";
import { labelPoint, svgPoints } from "~/maps/geometry";
import type { PartyFace } from "~/maps/tokens/types";
import type { AreaView, Size } from "~/maps/types";
import { mapUrl } from "~/maps/urls";

export const AREA_STYLES = {
  today: "Today (amber fill)",
  outline: "Outline only",
  quiet: "Quiet edge",
  pins: "Pins",
  hidden: "Hidden until hover",
} as const;
export type AreaStyle = keyof typeof AREA_STYLES;

interface Props {
  area: AreaView;
  size: Size;
  scale: number;
  style: AreaStyle;
  /** Drawn as if hovered: "show places", or highlighted from the list. */
  lit: boolean;
  /** Players' look: one style, never saying whether it's mapped. */
  plain: boolean;
  faces: readonly PartyFace[];
  /** Touch: this area has had its first tap, so the next one opens it. */
  previewed: boolean;
  onPreview: (area: AreaView) => void;
  onSelect: (area: AreaView) => void;
}

export function PrototypeArea(props: Props) {
  const { area, size, scale, style, lit, plain, faces, previewed, onPreview, onSelect } = props;
  const pointer = useRef("mouse");
  if (style === "today") {
    return <AreaShape area={area} size={size} scale={scale} plain={plain} onSelect={onSelect} />;
  }

  const [x, y] = labelPoint(area.outline, size);
  const mapped = !!area.map;
  const points = svgPoints(area.outline, size);
  const shown = lit || previewed;
  const onHover = "group-hover:opacity-100 group-focus-visible:opacity-100";
  const outlineOpacity = shown
    ? "opacity-100"
    : style === "outline"
      ? "opacity-100"
      : style === "quiet"
        ? `opacity-40 ${onHover}`
        : `opacity-0 ${onHover}`;
  const labelOpacity = shown ? "opacity-100" : `opacity-0 ${onHover}`;
  const dashed = !mapped && !plain ? "6 4" : undefined;
  const pin = style === "pins" && faces.length === 0;
  const s = 6 / scale;
  const labelY = pin || faces.length > 0 ? y + 20 / scale : y;

  const shape = (
    <>
      {/* The whole area takes the pointer, even though nothing is painted over the art. */}
      <polygon points={points} fill="transparent" pointerEvents="all" />
      <g className={`pointer-events-none transition-opacity duration-150 ${outlineOpacity}`}>
        {style === "outline" ? (
          <polygon
            points={points}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeDasharray={dashed}
            className={`${mapped || plain ? "stroke-amber-700" : "stroke-stone-700"} fill-transparent group-hover:fill-amber-200/20 group-focus-visible:fill-amber-200/20`}
          />
        ) : (
          <>
            <polygon
              points={points}
              vectorEffect="non-scaling-stroke"
              strokeWidth={4}
              className="fill-none stroke-black/40"
            />
            <polygon
              points={points}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeDasharray={dashed}
              className={`stroke-white ${shown ? "fill-white/10" : "fill-white/0 group-hover:fill-white/10 group-focus-visible:fill-white/10"}`}
            />
          </>
        )}
      </g>
      {pin && (
        <path
          d={`M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`}
          strokeWidth={1.5 / scale}
          className={`pointer-events-none transition-transform ${
            mapped || plain
              ? "fill-[#f6efdc] stroke-stone-900"
              : "fill-stone-900/50 stroke-[#f6efdc]"
          }`}
        />
      )}
      {faces.length > 0 && <Faces id={area.id} faces={faces} x={x} y={y} scale={scale} />}
      <text
        x={x}
        y={labelY}
        fontSize={14 / scale}
        strokeWidth={3 / scale}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`pointer-events-none fill-stone-900 stroke-white font-sans font-semibold transition-opacity [paint-order:stroke] ${labelOpacity}`}
      >
        {area.name}
        {!mapped && !plain && " · not mapped yet"}
        {previewed && " — tap again to open"}
      </text>
    </>
  );

  // Touch has no hover: the first tap shows the area, the second opens it.
  const firstTap = (event: MouseEvent) => {
    if (pointer.current !== "touch" || previewed) return false;
    event.preventDefault();
    onPreview(area);
    return true;
  };
  const common = {
    className: "group cursor-pointer outline-none",
    onPointerDown: (event: { pointerType: string }) => (pointer.current = event.pointerType),
  };
  if (area.map) {
    return (
      <Link to={mapUrl(area.map.id)} aria-label={area.name} onClick={firstTap} {...common}>
        {shape}
      </Link>
    );
  }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={plain ? area.name : `${area.name}, not mapped yet`}
      onClick={(event) => {
        if (!firstTap(event)) onSelect(area);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(area);
      }}
      {...common}
    >
      {shape}
    </g>
  );
}

/** The party's faces where the pin would be. */
function Faces({
  id,
  faces,
  x,
  y,
  scale,
}: {
  id: string;
  faces: readonly PartyFace[];
  x: number;
  y: number;
  scale: number;
}) {
  const r = 10 / scale;
  const step = r * 1.5;
  const start = x - ((faces.length - 1) * step) / 2;
  return (
    <g className="pointer-events-none">
      {faces.map((face, index) => {
        const cx = start + index * step;
        const clip = `proto-face-${id}-${index}`;
        return (
          <g key={index}>
            <clipPath id={clip}>
              <circle cx={cx} cy={y} r={r} />
            </clipPath>
            <circle cx={cx} cy={y} r={r + 1.5 / scale} className="fill-stone-900" />
            {face.portraitUrl ? (
              <image
                href={face.portraitUrl}
                x={cx - r}
                y={y - r}
                width={r * 2}
                height={r * 2}
                preserveAspectRatio="xMidYMin slice"
                clipPath={`url(#${clip})`}
              />
            ) : (
              <>
                <circle cx={cx} cy={y} r={r} className="fill-[#f6efdc]" />
                <text
                  x={cx}
                  y={y}
                  fontSize={r}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-stone-900 font-sans font-bold"
                >
                  {face.name.slice(0, 1)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
