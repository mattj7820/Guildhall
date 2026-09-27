import type { KeyboardEvent } from "react";
import { Link } from "react-router";
import { labelPoint, svgPoints } from "~/maps/geometry";
import type { AreaView, Size } from "~/maps/types";
import { mapUrl } from "~/maps/urls";

interface Props {
  area: AreaView;
  size: Size;
  /** Screen pixels per image pixel, so the label stays the same size on screen. */
  scale: number;
  selected?: boolean;
  /** Clicking an area that doesn't lead to a map (or pressing Enter or Space on it). */
  onSelect?: (area: AreaView) => void;
}

/**
 * One outlined area. An area with a map is a real link, so Enter, middle-click and "open in new
 * tab" work; one without a map yet is a button that shows it in the side panel. The name appears
 * on hover and keyboard focus.
 */
export function AreaShape({ area, size, scale, selected = false, onSelect }: Props) {
  const [labelX, labelY] = labelPoint(area.outline, size);
  const mapped = !!area.map;
  const shape = (
    <>
      <polygon
        points={svgPoints(area.outline, size)}
        vectorEffect="non-scaling-stroke"
        strokeWidth={2}
        strokeDasharray={mapped ? undefined : "6 4"}
        className={`${mapped ? MAPPED : UNMAPPED} ${selected ? "stroke-[3]" : ""} group-focus-visible:stroke-[4]`}
        data-selected={selected || undefined}
      />
      <text
        x={labelX}
        y={labelY}
        fontSize={14 / scale}
        strokeWidth={3 / scale}
        textAnchor="middle"
        dominantBaseline="middle"
        className={`pointer-events-none fill-stone-900 stroke-white font-sans font-semibold [paint-order:stroke] ${
          selected ? "" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      >
        {area.name}
        {!mapped && " · not mapped yet"}
      </text>
    </>
  );

  const focusRing = "group cursor-pointer outline-none";
  if (area.map) {
    return (
      <Link to={mapUrl(area.map.id)} aria-label={area.name} className={focusRing}>
        {shape}
      </Link>
    );
  }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${area.name}, not mapped yet`}
      aria-pressed={selected}
      className={focusRing}
      onClick={() => onSelect?.(area)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.(area);
      }}
    >
      {shape}
    </g>
  );
}

/** Areas with a map are solid amber; areas without one yet are dashed grey. Both fill on hover. */
const MAPPED =
  "stroke-amber-700 fill-amber-400/15 group-hover:fill-amber-400/40 group-focus-visible:fill-amber-400/40 data-selected:fill-amber-400/40 dark:stroke-amber-400";
const UNMAPPED =
  "stroke-stone-700 fill-stone-300/15 group-hover:fill-stone-300/45 group-focus-visible:fill-stone-300/45 data-selected:fill-stone-300/45 dark:stroke-stone-200";
