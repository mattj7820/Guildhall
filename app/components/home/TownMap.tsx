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
import { HALL_SPOTS, routeOf, sharedWay, STAND, VIEW, type Place, type PlaceId } from "~/home/town";
import { rememberedPlace, rememberPlace } from "~/home/town-position";

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
  /** Under the map, in its column. */
  below?: ReactNode;
  panel: (walkTo: (id: PlaceId) => (event: MouseEvent) => void, hot: PlaceSetter) => ReactNode;
}

export interface PlaceSetter {
  hot: PlaceId | null;
  setHot: (id: PlaceId | null) => void;
}

/**
 * The guildhall as a drawn plan: each module a place, the campaign shown where it happens, and the
 * viewer's token walking the dashed paths when they pick somewhere to go (straight there under
 * reduced motion, or with a second click). Every place is a real link.
 */
export function TownMap(props: TownMapProps) {
  const { places, hrefs, fight } = props;
  const navigate = useNavigate();
  const [hot, setHot] = useState<PlaceId | null>(null);
  const byId = new Map(places.map((place) => [place.id, place]));
  const walker = useWalker((id) => routeOf(byId.get(id) ?? {}));
  const { token, trails, reveals, scroller } = walker;

  // Back from a page, the token starts at that page's place and walks home to the hall.
  useLayoutEffect(() => {
    const last = rememberedPlace();
    if (!last || last === "hall" || !byId.has(last)) return;
    walker.standAt(last);
    // Home only once it gets there: an effect can run twice (React's strict mode), and the
    // second run must still walk. Without motion, it's simply home.
    const home = () => rememberPlace("hall");
    if (!walker.go("hall", { fade: true, done: home })) {
      walker.standAt("hall");
      home();
    }
    // Once, on arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function walkTo(id: PlaceId) {
    return (event: MouseEvent) => {
      const href = hrefs[id];
      if (!byId.get(id)?.route || !href) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      const arrive = () => {
        if (href.startsWith("#")) document.getElementById(href.slice(1))?.focus();
        else void navigate(href);
      };
      // A second click on where it's already heading goes now; anywhere else turns it around.
      if (walker.heading() === id || !walker.go(id, { done: arrive })) arrive();
    };
  }

  const hotPlace = hot ? byId.get(hot) : undefined;
  const prefetch = hot && hrefs[hot];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <div className="gh-town relative overflow-hidden rounded-2xl border border-line">
          <div className="overflow-x-auto overscroll-x-contain" ref={scroller}>
            <svg
              viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
              className="gh-town-art block h-auto w-full min-w-[600px]"
              role="group"
              aria-label="The guildhall: pick a place to go there"
            >
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
              {/* A walk's two legs: back to where the ways part, then out along the new one. */}
              {[0, 1].map((leg) => (
                <g key={leg}>
                  <path
                    ref={trails[leg]}
                    className="gh-town-trail"
                    mask={`url(#gh-town-walked-${leg})`}
                    d=""
                  />
                  <mask id={`gh-town-walked-${leg}`} maskUnits="userSpaceOnUse">
                    <path ref={reveals[leg]} className="gh-town-reveal" d="" />
                  </mask>
                </g>
              ))}
              <g ref={token} transform={`translate(${STAND.x},${STAND.y})`}>
                <Face face={props.you} r={15} className="gh-town-you" label="You" />
              </g>
            </svg>
          </div>
        </div>
        {props.below}
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
      <text x={588} y={562} className="gh-town-label" style={{ fontSize: 15 }}>
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
interface Leg {
  place: PlaceId;
  d: string;
  /** Lengths along `d`: where this leg starts and ends. */
  from: number;
  to: number;
}

/**
 * The token's walks. It's always somewhere along a place's route (the hall's is just the spot
 * where it stands), so a walk goes back along that route to where it parts from the next place's,
 * then out along that one: the shortest way by the corridors, and a walk can turn mid-way.
 */
function useWalker(routeFor: (id: PlaceId) => string) {
  const token = useRef<SVGGElement>(null);
  const trails = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const reveals = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];
  const scroller = useRef<HTMLDivElement>(null);
  const measure = useRef<SVGPathElement | null>(null);
  const at = useRef<{ place: PlaceId; along: number }>({ place: "hall", along: 0 });
  const target = useRef<PlaceId | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    // On a narrow screen the map scrolls sideways: start with the hall in the middle.
    const box = scroller.current;
    if (box) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
    return () => cancelAnimationFrame(frame.current);
  }, []);

  /** A path to measure routes with, off the page. */
  function ruler(d: string): SVGPathElement {
    measure.current ??= document.createElementNS("http://www.w3.org/2000/svg", "path");
    measure.current.setAttribute("d", d || "M0,0");
    return measure.current;
  }

  function lengthOf(d: string): number {
    return d ? ruler(d).getTotalLength() : 0;
  }

  function show(d: string, along: number) {
    const point = ruler(d).getPointAtLength(along);
    token.current?.setAttribute(
      "transform",
      `translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`,
    );
  }

  /** Stands the token at a place, without walking there. */
  function standAt(place: PlaceId) {
    const d = routeFor(place);
    at.current = { place, along: lengthOf(d) };
    show(d, at.current.along);
  }

  /** False when there's no walking to do (reduced motion): the caller goes straight there. */
  function go(place: PlaceId, { done, fade = false }: { done?: () => void; fade?: boolean }) {
    if (prefersReducedMotion()) return false;
    cancelAnimationFrame(frame.current);
    const from = routeFor(at.current.place);
    const to = routeFor(place);
    const parting = lengthOf(sharedWay(from, to));
    const legs: Leg[] = [
      { place: at.current.place, d: from, from: at.current.along, to: parting },
      { place, d: to, from: parting, to: lengthOf(to) },
    ];
    legs.forEach((leg, index) => {
      trails[index]!.current?.setAttribute("d", leg.d);
      trails[index]!.current?.classList.remove("gh-town-trail-fade");
      reveals[index]!.current?.setAttribute("d", leg.d);
    });
    const spans = legs.map((leg) => Math.abs(leg.to - leg.from));
    const distance = spans[0]! + spans[1]!;
    const ms = Math.max(450, Math.min(1400, distance * 2.3));
    const start = performance.now();
    target.current = place;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      let left = distance * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      legs.forEach((leg, index) => {
        const walked = Math.min(left, spans[index]!);
        left -= walked;
        const along = leg.from + Math.sign(leg.to - leg.from) * walked;
        // This leg's part of the trail drawn out behind the token.
        const reveal = reveals[index]!.current;
        if (reveal) {
          reveal.style.strokeDasharray = `${walked} ${lengthOf(leg.d) * 2 + 1}`;
          reveal.style.strokeDashoffset = String(-Math.min(leg.from, along));
        }
        if (index === 0 || walked > 0) {
          at.current = { place: leg.place, along };
          show(leg.d, along);
        }
      });
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      target.current = null;
      if (fade) trails.forEach((trail) => trail.current?.classList.add("gh-town-trail-fade"));
      done?.();
    };
    frame.current = requestAnimationFrame(step);
    return true;
  }

  return { token, trails, reveals, scroller, standAt, go, heading: () => target.current };
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
