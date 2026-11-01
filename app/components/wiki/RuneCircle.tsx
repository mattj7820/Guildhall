/**
 * The circle drawn while a spell is cast: its rings draw in when the spell starts, a rune inks in
 * for each letter typed, and the star in the middle draws once something answers. Decoration only.
 */

const RUNES = 16;

// Each rune is a few strokes from a fixed seed, so server and browser draw the same circle.
const RUNE_PATHS = (() => {
  let seed = 7;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: RUNES }, (_, i) => {
    const angle = (i / RUNES) * Math.PI * 2 - Math.PI / 2;
    const x = 60 + Math.cos(angle) * 45;
    const y = 60 + Math.sin(angle) * 45;
    let d = `M${(x + (next() - 0.5) * 6).toFixed(1)},${(y - 4).toFixed(1)}`;
    for (let k = 0; k < 2; k++)
      d += ` L${(x + (next() - 0.5) * 7).toFixed(1)},${(y + (next() - 0.5) * 8).toFixed(1)}`;
    return {
      d,
      rotate: `rotate(${((angle * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`,
    };
  });
})();

const STAR = [0, 1, 2, 3, 4]
  .map((i) => {
    const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return `${(60 + Math.cos(angle) * 32).toFixed(1)},${(60 + Math.sin(angle) * 32).toFixed(1)}`;
  })
  .join(" ");

export function RuneCircle({
  letters,
  answered,
  pulse,
}: {
  /** How many letters have been spoken: one rune each, and the ring turns a little. */
  letters: number;
  /** Something answered the spell. */
  answered: boolean;
  /** Changes each time an answer arrives, to flare the circle. */
  pulse: number;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className="gh-rune-circle size-24 shrink-0"
      data-answered={answered || undefined}
    >
      <g className="gh-rune-ring" style={{ transform: `rotate(${letters * 12}deg)` }}>
        <circle className="gh-rune-draw" cx="60" cy="60" r="55" strokeWidth="1.5" pathLength={1} />
        <circle
          className="gh-rune-draw gh-rune-later"
          cx="60"
          cy="60"
          r="36"
          strokeWidth="1"
          pathLength={1}
        />
        <g strokeWidth="1.6">
          {RUNE_PATHS.map((rune, i) => (
            <path
              key={i}
              d={rune.d}
              transform={rune.rotate}
              pathLength={1}
              className="gh-rune"
              data-lit={i < letters || undefined}
            />
          ))}
        </g>
      </g>
      <polygon className="gh-rune-star" points={STAR} strokeWidth="1.2" pathLength={1} />
      {pulse > 0 && (
        <circle key={pulse} className="gh-rune-pulse" cx="60" cy="60" r="55" strokeWidth="2" />
      )}
    </svg>
  );
}
