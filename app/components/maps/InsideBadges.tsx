import { labelPoint } from "~/maps/geometry";
import type { InsideBadge } from "~/maps/tokens/types";
import type { AreaView, Size } from "~/maps/types";
import { CLIP_ID } from "./TokenLayer";

/** A badge's faces on screen, whatever the zoom. */
const FACE = 11;
const MOST_FACES = 3;

/**
 * Who's inside the areas that lead to deeper maps: a small badge on each, with their faces, like
 * a game's map screen showing where the party is. Only what the server worked out this viewer may
 * see.
 */
export function InsideBadges({
  badges,
  areas,
  size,
  scale,
}: {
  badges: readonly InsideBadge[];
  areas: readonly AreaView[];
  size: Size;
  scale: number;
}) {
  const r = FACE / scale;
  return (
    <g aria-label="Who's inside" role="group" className="pointer-events-none">
      {badges.map((badge) => {
        const area = areas.find((each) => each.id === badge.area);
        if (!area) return null;
        const [x, y] = labelPoint(area.outline, size);
        const faces = badge.members.slice(0, MOST_FACES);
        const more = badge.members.length - faces.length;
        const width = (faces.length + (more > 0 ? 1 : 0)) * r * 1.6 + r * 0.8;
        // Above the area's name, which sits on its label point.
        const top = y - r * 3.2;
        return (
          <g
            key={badge.area}
            role="img"
            aria-label={`Inside ${area.name}: ${badge.members.map((member) => member.name).join(", ")}`}
          >
            <rect
              x={x - width / 2}
              y={top - r * 1.3}
              width={width}
              height={r * 2.6}
              rx={r * 1.3}
              className="fill-white/90 stroke-stone-900"
              strokeWidth={1 / scale}
            />
            {faces.map((member, index) => {
              const cx = x - width / 2 + r * 1.2 + index * r * 1.6;
              return member.portraitUrl ? (
                <image
                  key={index}
                  href={member.portraitUrl}
                  x={cx - r}
                  y={top - r}
                  width={2 * r}
                  height={2 * r}
                  clipPath={`url(#${CLIP_ID})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <g key={index}>
                  <circle cx={cx} cy={top} r={r} className="fill-stone-700" />
                  <text
                    x={cx}
                    y={top}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r}
                    className="fill-white font-serif font-bold select-none"
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </text>
                </g>
              );
            })}
            {more > 0 && (
              <text
                x={x + width / 2 - r * 1.2}
                y={top}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={r}
                className="fill-stone-900 font-semibold select-none"
              >
                +{more}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
