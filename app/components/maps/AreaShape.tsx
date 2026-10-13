import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { Link } from "react-router";
import { labelPoint, svgPoints } from "~/maps/geometry";
import type { AreaView, Size } from "~/maps/types";
import { mapUrl } from "~/maps/urls";

interface Props {
  area: AreaView;
  size: Size;
  /** Screen pixels per image pixel, so the pin and label stay the same size on screen. */
  scale: number;
  selected?: boolean;
  /** Outlined and named as if pointed at: every place is shown, or it's picked out in a list. */
  lit?: boolean;
  /** The party's faces are on it (`InsideBadges`), in place of the pin. */
  occupied?: boolean;
  /** Touch: tapped once, so it's shown, and the next tap opens it. */
  previewed?: boolean;
  onPreview?: (area: AreaView) => void;
  /** Clicking an area that doesn't lead to a map (or pressing Enter or Space on it). */
  onSelect?: (area: AreaView) => void;
  /** For players: just the area's name, without saying whether it's mapped yet. */
  plain?: boolean;
}

/** Whether the last press on an area was a touch (set before its click). */
let touched = false;

/** The pin's half-width, and how far below it the name sits, on screen. */
const PIN = 6;
const LABEL_GAP = 22;

/**
 * One area, quiet over the art: a small pin where its name goes, with the outline and name shown
 * on hover and keyboard focus (or all at once with Places). The whole area takes the pointer. An
 * area with a map is a real link, so Enter, middle-click and "open in new tab" work; one without
 * a map yet is a button that shows it in the side panel. Touch has no hover, so the first tap
 * shows the area and the second opens it.
 */
export function AreaShape({
  area,
  size,
  scale,
  selected = false,
  lit = false,
  occupied = false,
  previewed = false,
  onPreview,
  onSelect,
  plain = false,
}: Props) {
  const [x, y] = labelPoint(area.outline, size);
  const points = svgPoints(area.outline, size);
  const mapped = !!area.map;
  // The DM tells mapped from unmapped: a dashed outline, and a hollow pin.
  const unmapped = !mapped && !plain;
  const shown = selected || lit || previewed;
  const reveal = shown
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100";
  const s = PIN / scale;

  const shape = (
    <>
      {/* Nothing is painted over the art, but the whole area still takes the pointer. */}
      <polygon points={points} fill="transparent" pointerEvents="all" />
      <g className={`pointer-events-none transition-opacity duration-150 ${reveal}`}>
        <polygon
          points={points}
          vectorEffect="non-scaling-stroke"
          strokeWidth={4}
          className="fill-white/10 stroke-black/40"
        />
        <polygon
          points={points}
          vectorEffect="non-scaling-stroke"
          strokeWidth={selected ? 2.5 : 1.5}
          strokeDasharray={unmapped ? "6 4" : undefined}
          className="fill-none stroke-white group-focus-visible:stroke-[3]"
        />
      </g>
      {!occupied && (
        <path
          d={`M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`}
          strokeWidth={1.5 / scale}
          className={`pointer-events-none ${
            unmapped ? "fill-stone-900/50 stroke-stone-50" : "fill-stone-50 stroke-stone-900"
          }`}
        />
      )}
      <text
        x={x}
        y={y + LABEL_GAP / scale}
        fontSize={14 / scale}
        strokeWidth={3 / scale}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`pointer-events-none fill-stone-900 stroke-white font-sans font-semibold transition-opacity duration-150 [paint-order:stroke] ${reveal}`}
      >
        {area.name}
        {unmapped && " · not mapped yet"}
      </text>
    </>
  );

  const common = {
    className: "group cursor-pointer outline-none",
    onPointerDown: (event: PointerEvent) => (touched = event.pointerType === "touch"),
  };
  /** True if this click was a first tap, which only shows the area. */
  const firstTap = (event: MouseEvent) => {
    if (!touched || previewed || !onPreview) return false;
    event.preventDefault();
    onPreview(area);
    return true;
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
      aria-pressed={selected}
      onClick={(event) => {
        if (!firstTap(event)) onSelect?.(area);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.(area);
      }}
      {...common}
    >
      {shape}
    </g>
  );
}
