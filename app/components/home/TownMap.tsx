import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { PrefetchPageLinks, useNavigate } from "react-router";
import { countdown } from "~/home/countdown";
import type { FightSummary } from "~/home/front-page";
import {
  FROM_GATE,
  HALL_SPOTS,
  STAND,
  TREES_INSIDE,
  TREES_OUTSIDE,
  VIEW,
  type Place,
  type PlaceId,
} from "~/home/town";

export interface TownFace {
  name: string;
  portraitUrl?: string;
}

export interface TownMapProps {
  places: Place[];
  /** Where each place leads; a place without one isn't a link. */
  hrefs: Partial<Record<PlaceId, string>>;
  fight: FightSummary | null;
  /** The map the party is on, pinned in the Chart Tower. */
  partyMap?: string;
  packs: number;
  waiting: number;
  nextSession?: string;
  you: TownFace;
  /** Whoever else is here now: who, never which page they're on. */
  others: TownFace[];
  /** The plain panel beside the map, given the way to walk somewhere from it. */
  panel: (walkTo: (id: PlaceId) => (event: MouseEvent) => void, hot: PlaceSetter) => ReactNode;
}

export interface PlaceSetter {
  hot: PlaceId | null;
  setHot: (id: PlaceId | null) => void;
}

/** The place the viewer last walked to from here, so coming back walks them home. */
const CAME_FROM = "guildhall:town-from";
const ARRIVED = "guildhall:town-arrived";

/**
 * The guildhall as a drawn plan: each module a place, the campaign shown where it happens, and the
 * viewer's token walking the dashed paths when they pick somewhere to go (straight there under
 * reduced motion, or with a second click). Every place is a real link.
 */
export function TownMap(props: TownMapProps) {
  const { places, hrefs, fight } = props;
  const navigate = useNavigate();
  const [hot, setHot] = useState<PlaceId | null>(null);
  const { token, trail, reveal, scroller, walk, walking } = useWalker();
  const byId = new Map(places.map((place) => [place.id, place]));

  // Coming back: walk home from where they went, or in through the gate on a first visit.
  useLayoutEffect(() => {
    const from = session(CAME_FROM);
    const place = from ? byId.get(from as PlaceId) : undefined;
    sessionSet(CAME_FROM, null);
    if (place?.route) walk(place.route, { backwards: true, fade: true });
    else if (!session(ARRIVED)) walk(FROM_GATE, { fade: true });
    sessionSet(ARRIVED, "1");
    // Once, on arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function walkTo(id: PlaceId) {
    return (event: MouseEvent) => {
      const place = byId.get(id);
      const href = hrefs[id];
      if (!place?.route || !href) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      const arrive = () => {
        if (href.startsWith("#")) {
          document.getElementById(href.slice(1))?.focus();
          return;
        }
        sessionSet(CAME_FROM, id);
        void navigate(href);
      };
      // A second click while walking, or no motion wanted: go now.
      if (walking() || !walk(place.route, { done: arrive })) arrive();
    };
  }

  const hotPlace = hot ? byId.get(hot) : undefined;
  const prefetch = hot && hrefs[hot];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="gh-town relative min-w-0 self-start overflow-hidden rounded-2xl border border-line">
        <div className="overflow-x-auto overscroll-x-contain" ref={scroller}>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className="block h-auto w-full min-w-[600px]"
            role="group"
            aria-label="The guildhall: pick a place to go there"
          >
            <Defs />
            <Grounds />
            <Buildings places={places} />
            <Furnishings />
            {places.map((place) => (
              <PlaceLink
                key={place.id}
                place={place}
                href={hrefs[place.id]}
                hot={hot === place.id}
                fight={place.id === "war" ? fight : null}
                onHot={setHot}
                onClick={walkTo(place.id)}
              >
                {place.id === "board" && <NoticeBoard at={props.nextSession} />}
              </PlaceLink>
            ))}
            <Campaign {...props} />
            {hotPlace?.route && <path d={hotPlace.route} className="gh-town-way" />}
            <Others key={props.others.map((face) => face.name).join()} faces={props.others} />
            <path ref={trail} className="gh-town-trail" mask="url(#gh-town-walked)" d="" />
            <mask id="gh-town-walked" maskUnits="userSpaceOnUse">
              <path ref={reveal} className="gh-town-reveal" d="" />
            </mask>
            <g ref={token} transform={`translate(${STAND.x},${STAND.y})`}>
              <Face face={props.you} r={15} className="gh-town-you" label="You" />
            </g>
          </svg>
        </div>
      </div>
      {prefetch && !prefetch.startsWith("#") && <PrefetchPageLinks page={prefetch} />}
      {props.panel(walkTo, { hot, setHot })}
    </div>
  );
}

function PlaceLink({
  place,
  href,
  hot,
  fight,
  onHot,
  onClick,
  children,
}: {
  place: Place;
  href?: string;
  hot: boolean;
  fight: FightSummary | null;
  onHot: (id: PlaceId | null) => void;
  onClick: (event: MouseEvent) => void;
  children?: ReactNode;
}) {
  const small = place.id === "board";
  const body = (
    <>
      <path d={place.shape} className="gh-town-hit" />
      {children}
      {small ? null : (
        <>
          <text
            x={place.label.x}
            y={place.label.y}
            className="gh-town-label"
            style={{ fontSize: place.name.length > 12 ? 17 : 21 }}
          >
            {place.name}
          </text>
          <text x={place.label.x} y={place.label.y + 17} className="gh-town-sub">
            {place.module}
          </text>
        </>
      )}
    </>
  );
  const className = `gh-town-place ${hot ? "gh-town-hot" : ""} ${fight ? "gh-town-fight" : ""}`;
  if (!href) {
    return (
      <g className={className} aria-hidden>
        {body}
      </g>
    );
  }
  return (
    <a
      href={href}
      className={className}
      aria-label={`${place.name}: ${place.module}`}
      onClick={onClick}
      onPointerEnter={() => onHot(place.id)}
      onPointerLeave={() => onHot(null)}
      onFocus={() => onHot(place.id)}
      onBlur={() => onHot(null)}
    >
      {body}
    </a>
  );
}

/** What's going on, drawn where it happens. */
function Campaign({ places, fight, partyMap, packs, waiting }: TownMapProps) {
  const has = (id: PlaceId) => places.some((place) => place.id === id);
  const line = fight && `Round ${fight.round}${fight.turn ? ` · ${fight.turn}'s turn` : ""}`;
  return (
    <g aria-hidden className="pointer-events-none">
      {/* Braziers by the War Room's door, and a flag over the Chart Tower. */}
      <circle cx={722} cy={312} r={4} className="gh-town-brazier" />
      <circle cx={722} cy={350} r={4} className="gh-town-brazier" />
      <rect x={500} y={52} width={2.5} height={30} className="gh-town-pole" />
      <path d="M502,52 l26,7 l-26,7 z" className="gh-town-flag" />
      {partyMap && (
        <>
          <circle cx={530} cy={122} r={6} className="gh-town-pin" />
          <text x={500} y={100} className="gh-town-sub" style={{ fontSize: 10.5 }}>
            {`Party: ${clip(partyMap, 22)}`}
          </text>
        </>
      )}
      {line && (
        <>
          <circle cx={852} cy={268} r={6} className="gh-town-pulse" />
          <g
            transform={`translate(${790 - pennantWidth(line) / 2},420)`}
            className="gh-town-pennant"
          >
            <rect width={pennantWidth(line)} height={22} rx={3} />
            <text x={pennantWidth(line) / 2} y={15}>
              {line}
            </text>
          </g>
        </>
      )}
      {packs > 0 && (
        <>
          <path
            d="M0,-7 L2,-2 L7,0 L2,2 L0,7 L-2,2 L-7,0 L-2,-2 Z"
            transform="translate(845,448)"
            className="gh-town-glint"
          />
          <text x={797} y={510} className="gh-town-sub" style={{ fontSize: 10.5 }}>
            {packs === 1 ? "1 pack to open" : `${packs} packs to open`}
          </text>
        </>
      )}
      {has("steward") && waiting > 0 && (
        <g transform="translate(828,140)" className="gh-town-badge">
          <rect x={-34} y={-10} width={68} height={18} rx={9} />
          <text y={3}>{`${waiting} waiting`}</text>
        </g>
      )}
    </g>
  );
}

function NoticeBoard({ at }: { at?: string }) {
  // The countdown is the browser's, in its own time zone, so it waits for the browser.
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const label = at && now ? countdown(new Date(at), now) : undefined;
  return (
    <>
      <g className="gh-town-board">
        <rect x={560} y={474} width={56} height={30} rx={2} />
        <rect x={566} y={480} width={18} height={18} className="gh-town-paper" />
        <rect x={589} y={479} width={20} height={14} className="gh-town-paper" />
        <rect x={566} y={504} width={4} height={10} />
        <rect x={606} y={504} width={4} height={10} />
      </g>
      <text x={588} y={530} className="gh-town-label gh-town-on-pave" style={{ fontSize: 15 }}>
        {label ? `Next session: ${label}` : "Notice board"}
      </text>
    </>
  );
}

/** Whoever else is here mills about the hall, one step at a time. */
function Others({ faces }: { faces: TownFace[] }) {
  const [spots, setSpots] = useState(() => faces.map((_, index) => index % HALL_SPOTS.length));
  useEffect(() => {
    if (faces.length === 0 || prefersReducedMotion()) return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      setSpots((current) => {
        const who = tick % current.length;
        const taken = new Set(current);
        let next = current[who]!;
        do next = (next + 1) % HALL_SPOTS.length;
        while (taken.has(next) && next !== current[who]);
        return current.map((spot, index) => (index === who ? next : spot));
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [faces.length]);
  return (
    <g>
      {faces.map((face, index) => {
        const spot = HALL_SPOTS[spots[index] ?? index % HALL_SPOTS.length]!;
        return (
          <g
            key={face.name}
            className="gh-town-other"
            style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }}
          >
            <Face face={face} r={11} label={`${face.name}, here now`} />
          </g>
        );
      })}
    </g>
  );
}

function Face({
  face,
  r,
  label,
  className = "",
}: {
  face: TownFace;
  r: number;
  label: string;
  className?: string;
}) {
  const clip = `gh-town-face-${slug(face.name)}-${r}`;
  return (
    <g className={`gh-town-face ${className}`}>
      <title>{label}</title>
      <circle r={r} />
      {face.portraitUrl ? (
        <>
          <clipPath id={clip}>
            <circle r={r - 2} />
          </clipPath>
          <image
            href={face.portraitUrl}
            x={-r}
            y={-r}
            width={r * 2}
            height={r * 2}
            preserveAspectRatio="xMidYMin slice"
            clipPath={`url(#${clip})`}
          />
        </>
      ) : (
        <text y={r * 0.3} style={{ fontSize: r * 0.85 }}>
          {initials(face.name)}
        </text>
      )}
    </g>
  );
}

/** The token's walk: along a route, the dashed trail drawn out behind it. */
function useWalker() {
  const token = useRef<SVGGElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const moving = useRef(false);

  useEffect(() => {
    // On a narrow screen the map scrolls sideways: start with the hall in the middle.
    const box = scroller.current;
    if (box) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
  }, []);

  function place(x: number, y: number) {
    token.current?.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
  }

  /** False when there's no walking to do (reduced motion): the caller goes straight there. */
  function walk(
    d: string,
    {
      backwards = false,
      fade = false,
      done,
    }: { backwards?: boolean; fade?: boolean; done?: () => void },
  ): boolean {
    const path = trail.current;
    const mask = reveal.current;
    if (!path || !mask || prefersReducedMotion()) return false;
    path.setAttribute("d", d);
    mask.setAttribute("d", d);
    path.classList.remove("gh-town-trail-fade");
    const length = path.getTotalLength();
    mask.style.strokeDasharray = `${length} ${length}`;
    const at = (t: number) => {
      const point = path.getPointAtLength(backwards ? length * (1 - t) : length * t);
      place(point.x, point.y);
      mask.style.strokeDashoffset = String(backwards ? -length * (1 - t) : length * (1 - t));
    };
    at(0);
    const ms = Math.max(500, Math.min(1100, length * 2.4));
    const start = performance.now();
    moving.current = true;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      at(t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      if (t < 1) return void requestAnimationFrame(step);
      moving.current = false;
      if (fade) path.classList.add("gh-town-trail-fade");
      done?.();
    };
    requestAnimationFrame(step);
    return true;
  }

  return { token, trail, reveal, scroller, walk, walking: () => moving.current };
}

function Defs() {
  return (
    <defs>
      <filter id="gh-town-rough" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} />
        <feDisplacementMap in="SourceGraphic" scale={5} />
      </filter>
      <filter id="gh-town-wash">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={3} seed={9} />
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.45  0 0 0 0 0.2  0 0 0 0.35 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <pattern id="gh-town-floor" width={22} height={22} patternUnits="userSpaceOnUse">
        <rect width={22} height={22} className="gh-town-floor-base" />
        <path d="M0 11h22M0 0h22M8 0v11M17 11v11" className="gh-town-floor-seam" />
      </pattern>
      <pattern id="gh-town-paving" width={18} height={16} patternUnits="userSpaceOnUse">
        <rect width={18} height={16} className="gh-town-pave-base" />
        <circle cx={5} cy={5} r={3.6} className="gh-town-pave-stone" />
        <circle cx={14} cy={12} r={3.6} className="gh-town-pave-stone" />
      </pattern>
    </defs>
  );
}

function Grounds() {
  return (
    <g aria-hidden>
      <rect width={VIEW.width} height={VIEW.height} className="gh-town-ground" />
      <rect
        width={VIEW.width}
        height={VIEW.height}
        filter="url(#gh-town-wash)"
        className="gh-town-wash"
      />
      <ellipse cx={140} cy={640} rx={120} ry={44} className="gh-town-grass" />
      <ellipse cx={900} cy={640} rx={140} ry={50} className="gh-town-grass" />
      <ellipse cx={175} cy={645} rx={62} ry={24} className="gh-town-water" />
      <path
        d="M470,712 C420,676 572,656 522,622 C496,604 504,596 500,586"
        className="gh-town-road"
      />
      <Trees at={TREES_OUTSIDE} />
      <text x={420} y={690} className="gh-town-outside">
        The approach
      </text>
      <text x={175} y={690} className="gh-town-outside">
        Pond
      </text>
      <text x={900} y={600} className="gh-town-outside">
        The grounds
      </text>
      <path
        d="M560,586 L895,540 L925,340 L890,150 L740,78 L500,58 L260,80 L110,140 L80,340 L120,550 L440,586"
        className="gh-town-curtain gh-town-rough"
      />
      <path d="M440,586 L560,586" className="gh-town-gap" />
      <ellipse cx={345} cy={128} rx={58} ry={30} className="gh-town-grass" />
      <g className="gh-town-towers gh-town-rough">
        {[
          [110, 140, 22],
          [890, 150, 22],
          [895, 540, 22],
          [120, 550, 22],
          [80, 340, 18],
          [925, 340, 18],
          [440, 590, 18],
          [560, 590, 18],
        ].map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <text x={500} y={622} className="gh-town-outside gh-town-on-road">
        Gate
      </text>
    </g>
  );
}

/** Walls first, then floors over them, so rooms and their corridors join up. */
function Buildings({ places }: { places: Place[] }) {
  const rooms = places.filter((place) => place.id !== "board");
  const layer = (className: string) => (
    <g className={className}>
      {rooms.map((place) => (
        <path key={place.id} d={place.shape} />
      ))}
      {rooms.map(
        (place) =>
          place.corridor && (
            <path key={`${place.id}-way`} d={place.corridor} className="gh-town-cor" />
          ),
      )}
    </g>
  );
  return (
    <g aria-hidden>
      {layer("gh-town-walls gh-town-rough")}
      {layer("gh-town-stones")}
      {layer("gh-town-floors gh-town-rough")}
      {/* The hall's door onto the courtyard. */}
      <rect x={478} y={410} width={44} height={20} className="gh-town-door" />
    </g>
  );
}

function Furnishings() {
  return (
    <g aria-hidden>
      <g className="gh-town-detail">
        <rect x={420} y={368} width={160} height={16} rx={3} />
        <rect x={470} y={256} width={60} height={12} className="gh-town-solid" />
        <path d="M120,215 h40 M118,240 h22 M150,350 h60 M250,180 h30 M276,262 v50" />
        <circle cx={500} cy={128} r={24} />
        <path d="M500,108 v40 M480,128 h40" />
        <circle cx={790} cy={345} r={26} />
        <path d="M180,420 h28 v14 h-28z M180,505 h28 v14 h-28z M262,420 h28 v14 h-28z" />
        <path d="M745,465 l14,-8 l14,8 v14 h-28z M800,470 h26 v18 h-26z" />
        <path d="M730,170 h40" />
      </g>
      <Trees at={TREES_INSIDE} />
      <circle cx={415} cy={500} r={15} className="gh-town-well" />
      <circle cx={415} cy={500} r={7} className="gh-town-water" />
      <text x={415} y={537} className="gh-town-outside gh-town-on-pave" style={{ fontSize: 13 }}>
        Well
      </text>
      <text x={500} y={458} className="gh-town-outside gh-town-on-pave">
        Courtyard
      </text>
      <text x={345} y={156} className="gh-town-outside gh-town-on-pave" style={{ fontSize: 13 }}>
        Garden
      </text>
    </g>
  );
}

function Trees({ at }: { at: [number, number][] }) {
  return (
    <g>
      {at.map(([x, y]) => (
        // Drawn out rather than <use>d, so the theme's colours reach them.
        <g
          key={`${x},${y}`}
          transform={`translate(${x},${y}) scale(${0.8 + ((x * 7 + y) % 5) / 10})`}
        >
          <circle r={17} className="gh-town-tree-dark" />
          <circle r={12} cx={-3} cy={-3} className="gh-town-tree-light" />
        </g>
      ))}
    </g>
  );
}

function pennantWidth(text: string): number {
  return Math.max(120, text.length * 6.6 + 20);
}

function clip(text: string, most: number): string {
  return text.length > most ? `${text.slice(0, most - 1)}…` : text;
}

function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function session(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Without storage, every visit walks in from the gate.
  }
}
