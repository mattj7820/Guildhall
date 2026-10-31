/**
 * The front page: the campaign as it stands, for one viewer. Shapes shared with the browser, and
 * the pure choices behind them.
 */
import type { FightView } from "~/combat/fight";
import type { PartyFace, Whereabouts } from "~/maps/tokens/types";
import type { MapId, Point } from "~/maps/types";

export interface FrontPage {
  /** The map where the party is, as the viewer may see it. */
  banner?: Banner;
  party: PartyMember[];
  latestSession?: { title: string; url: string };
  fight: FightSummary | null;
}

export interface Banner {
  name: string;
  url: string;
  /** Players: what they've explored. None until there's something to show. */
  thumbnail?: string;
  size: { width: number; height: number };
  /** Party members' tokens on it, as the viewer may see them. */
  faces: (PartyFace & { at: Point })[];
}

export interface PartyMember extends PartyFace {
  kind: "pc" | "companion";
  /** "Elf · Wizard · level 3", from the sheet. */
  blurb: string;
}

export interface FightSummary {
  round: number;
  /** Whose turn it is, if the viewer may know: a hidden monster's turn is nobody's to players. */
  turn?: string;
  map?: MapId;
}

/**
 * The map to show: a player's is where their own character is; the DM's is where most of the
 * party is, the first of them on a tie. None when nobody the viewer may place is on a map.
 */
export function bannerMap(party: readonly Whereabouts[], forDm: boolean): MapId | undefined {
  const counts = new Map<MapId, number>();
  for (const member of party) {
    if (!member.map || (!forDm && !member.theirs)) continue;
    counts.set(member.map.id, (counts.get(member.map.id) ?? 0) + 1);
  }
  let best: MapId | undefined;
  for (const [map, count] of counts) {
    if (best === undefined || count > counts.get(best)!) best = map;
  }
  return best;
}

/** A running fight as the front page says it; nothing while the DM is still setting one up. */
export function fightSummary(view: FightView | null): FightSummary | null {
  if (!view) return null;
  const map = view.map && { map: view.map };
  if (view.forDm) {
    const { encounter } = view;
    if (encounter.phase !== "active") return null;
    const active = encounter.combatants.find((each) => each.id === encounter.activeId);
    return { round: encounter.round, ...(active && { turn: active.name }), ...map };
  }
  if (!view.view.started) return null;
  const active = view.view.turnOrder.find((each) => each.isActive);
  return { round: view.view.round, ...(active && { turn: active.name }), ...map };
}

const byTitle = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** The latest session note, by its title: "Session 10" comes after "Session 9". */
export function latestSession<T extends { title: string }>(sessions: readonly T[]): T | undefined {
  return [...sessions].sort((a, b) => byTitle.compare(a.title, b.title)).at(-1);
}
