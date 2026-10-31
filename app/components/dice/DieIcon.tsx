import type { DieStyle, DieType } from "~/dice/styles";

/** Each type's outline as seen from above, in a 100 × 100 box, and where its number sits. */
const OUTLINES: Record<DieType, { points: string; inner?: string; numberY: number }> = {
  4: { points: "50,6 95,88 5,88", numberY: 66 },
  6: { points: "12,12 88,12 88,88 12,88", numberY: 52 },
  8: { points: "50,4 94,50 50,96 6,50", inner: "6,50 94,50", numberY: 40 },
  10: { points: "50,4 94,42 50,96 6,42", inner: "6,42 50,62 94,42", numberY: 42 },
  12: {
    points: "50,4 96,38 78,94 22,94 4,38",
    inner: "50,22 76,42 66,72 34,72 24,42 50,22",
    numberY: 52,
  },
  20: { points: "50,3 93,27 93,73 50,97 7,73 7,27", inner: "50,18 82,70 18,70 50,18", numberY: 56 },
};

/**
 * A die drawn flat in its style's colours, showing its highest number: quick to draw in a list,
 * where the 3D dice would be heavy. Without a style, the theme's dice. Decorative.
 */
export function DieIcon({
  sides,
  style,
  size = 48,
}: {
  sides: DieType;
  style?: Pick<DieStyle, "look">;
  size?: number;
}) {
  const outline = OUTLINES[sides];
  const body = style?.look.body ?? "var(--color-accent)";
  const ink = style?.look.ink ?? "var(--color-on-accent)";
  const font = style?.look.font ?? "var(--font-display)";
  const opacity = style ? 0.4 + 0.6 * style.look.opacity : 1;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="shrink-0">
      <polygon
        points={outline.points}
        fill={body}
        fillOpacity={opacity}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {outline.inner && (
        <polyline
          points={outline.inner}
          fill="none"
          stroke={ink}
          strokeOpacity={0.3}
          strokeWidth={2}
        />
      )}
      <text
        x={50}
        y={outline.numberY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={ink}
        fontFamily={font}
        fontWeight="bold"
        fontSize={sides >= 10 ? 26 : 30}
      >
        {sides}
      </text>
    </svg>
  );
}
