/**
 * The front page's town map: a drawn plan of a walled guildhall, where each module is a place and
 * the viewer's token walks the paths between them. Geometry only, in the plan's own units
 * (VIEW wide and high); what each place leads to is the page's business. The scenery is a picture
 * per theme in `public/town/`, made in the mapgen repo to this geometry
 * (`docs/prototypes/hub-map-mapgen-prompt.md`): change one, change the other.
 */
import type { Role } from "~/campaign/types";

export const VIEW = { width: 1000, height: 700 };

export type PlaceId =
  "hall" | "library" | "tower" | "war" | "barracks" | "treasury" | "steward" | "board";

export interface Place {
  id: PlaceId;
  name: string;
  /** What it is in Guildhall's own words. */
  module: string;
  /** Its floor, as an SVG path: lit when pointed at. */
  shape: string;
  label: { x: number; y: number };
  /** The way from where the viewer stands in the hall to the place, as an SVG path. */
  route?: string;
  dmOnly?: boolean;
}

/** Where the viewer's token stands in the Great Hall. */
export const STAND = { x: 500, y: 365 };

const PLACES: Place[] = [
  {
    id: "hall",
    name: "Great Hall",
    module: "Front page",
    shape: "M375,250 L625,250 L655,295 L655,420 L345,420 L345,295 Z",
    label: { x: 500, y: 318 },
  },
  {
    id: "library",
    name: "Library",
    module: "Wiki",
    shape:
      "M120,195 L262,168 L298,236 L290,355 L148,372 L108,285 Z M75,183 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0",
    label: { x: 205, y: 292 },
    route: "M500,365 L500,388 L345,388 C300,392 335,322 292,322 L205,300",
  },
  {
    id: "tower",
    name: "Chart Tower",
    module: "Maps",
    shape: "M436,138 a64,64 0 1,0 128,0 a64,64 0 1,0 -128,0",
    label: { x: 500, y: 176 },
    route: "M500,365 L500,252 C470,232 540,222 500,203 L500,184",
  },
  {
    id: "war",
    name: "War Room",
    module: "Combat",
    shape: "M870,297 L870,363 L823,410 L757,410 L710,363 L710,297 L757,250 L823,250 Z",
    label: { x: 790, y: 312 },
    route: "M500,365 L500,352 L655,352 C685,372 680,312 712,330 L790,345",
  },
  {
    id: "steward",
    name: "Steward's Office",
    module: "Members",
    shape: "M690,145 L820,128 L852,205 L735,228 Z",
    label: { x: 770, y: 182 },
    route:
      "M500,365 L500,352 L655,352 C685,372 680,312 712,330 L790,300 L790,252 C805,238 770,236 782,222 L770,196",
    dmOnly: true,
  },
  {
    id: "barracks",
    name: "Barracks",
    module: "Characters",
    shape: "M165,400 L305,392 L325,470 L295,545 L175,545 L140,470 Z",
    label: { x: 232, y: 478 },
    route: "M500,365 L500,470 L420,470 C380,490 350,450 318,468 L232,490",
  },
  {
    id: "treasury",
    name: "Treasury",
    module: "Your dice",
    shape: "M725,440 L850,432 L868,515 L735,528 Z",
    label: { x: 797, y: 474 },
    route: "M500,365 L500,470 L580,470 C640,495 690,450 728,478 L797,492",
  },
  {
    id: "board",
    name: "Notice board",
    module: "Sessions",
    shape: "M555,506 h66 v40 h-66 z",
    label: { x: 588, y: 562 },
    route: "M500,365 L500,470 L556,536",
  },
];

/** The way from where the viewer stands in the hall to a place (none for the hall itself). */
export function routeOf(place: Pick<Place, "route">): string {
  return place.route ?? `M${STAND.x},${STAND.y}`;
}

/**
 * The start two routes share: where a walk from one place turns off for the other, so it goes
 * the shortest way along the corridors rather than always back through the hall.
 */
export function sharedWay(from: string, to: string): string {
  const steps = (route: string) => route.match(/[MLC][^MLC]*/g)?.map((step) => step.trim()) ?? [];
  const a = steps(from);
  const b = steps(to);
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1;
  return a.slice(0, shared).join(" ");
}

/** The places a viewer may go: the Steward's Office (Members) is the DM's. */
export function townPlaces(role: Role): Place[] {
  return PLACES.filter((place) => !place.dmOnly || role === "dm");
}

/** The pages each place stands for, by the start of their path. */
const PAGES: [string, PlaceId][] = [
  ["/wiki", "library"],
  ["/maps", "tower"],
  ["/combat", "war"],
  ["/characters", "barracks"],
  ["/settings/dice", "treasury"],
  ["/members", "steward"],
  ["/board", "board"],
];

/**
 * Where the viewer's token stands while they're on a page, however they got there: the place for
 * its module, the hall for pages without one, and nothing for the front page itself (where it
 * stays wherever they were last).
 */
export function placeOf(pathname: string): PlaceId | undefined {
  if (pathname === "/") return undefined;
  const page = PAGES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return page?.[1] ?? "hall";
}

/** Spots in the hall for whoever else is here, clear of the viewer's own. */
export const HALL_SPOTS = [
  { x: 440, y: 398 },
  { x: 560, y: 398 },
  { x: 410, y: 350 },
  { x: 590, y: 350 },
  { x: 470, y: 290 },
  { x: 530, y: 290 },
];
