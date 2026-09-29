/**
 * Maps nest through their areas: an area that leads to a map makes that map its child. Each map
 * has at most one parent, so the maps form a tree (strictly, a forest). The repository refuses
 * changes that break that, but these functions still cope with a hand-edited file that has a
 * second parent or a cycle, rather than looping or losing a map.
 */
import type { Area, AreaId, CampaignMap, MapId } from "./types";

/** The parts of a map the tree depends on. */
export type TreeMap = Pick<CampaignMap, "id" | "name"> & {
  areas: readonly Pick<Area, "id" | "name" | "map">[];
};

export interface ParentLink {
  mapId: MapId;
  areaId: AreaId;
}

export interface MapTreeNode<M extends TreeMap = TreeMap> {
  map: M;
  children: MapTreeNode<M>[];
}

/** Each map's parent, keyed by child. If a file names two parents, the first one counts. */
export function parentLinks(maps: readonly TreeMap[]): Map<MapId, ParentLink> {
  const exists = new Set(maps.map((map) => map.id));
  const parents = new Map<MapId, ParentLink>();
  for (const map of maps) {
    for (const area of map.areas) {
      if (area.map && exists.has(area.map) && !parents.has(area.map)) {
        parents.set(area.map, { mapId: map.id, areaId: area.id });
      }
    }
  }
  return parents;
}

/** The map's ancestors, outermost first. Stops if it meets a cycle. */
export function ancestors<M extends TreeMap>(id: MapId, maps: readonly M[]): M[] {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const parents = parentLinks(maps);
  const seen = new Set<MapId>([id]);
  const chain: M[] = [];
  for (let link = parents.get(id); link && !seen.has(link.mapId); link = parents.get(link.mapId)) {
    seen.add(link.mapId);
    const parent = byId.get(link.mapId);
    if (!parent) break;
    chain.unshift(parent);
  }
  return chain;
}

/**
 * The maps inside this one, at any depth: those its areas lead to, and theirs. Stops if it meets
 * a cycle.
 */
export function descendants(id: MapId, maps: readonly TreeMap[]): MapId[] {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const parents = parentLinks(maps);
  const found: MapId[] = [];
  const seen = new Set<MapId>([id]);
  const visit = (parent: MapId) => {
    for (const area of byId.get(parent)?.areas ?? []) {
      const child = area.map;
      // Only the parent a map really has: a second link to it (a hand-edited file) doesn't count.
      if (!child || seen.has(child) || parents.get(child)?.mapId !== parent) continue;
      seen.add(child);
      found.push(child);
      visit(child);
    }
  };
  visit(id);
  return found;
}

/**
 * Every map as a tree, top-level maps first in the given order. Maps caught in a cycle (so with
 * no top-level ancestor) are listed at the top level too, so none go missing.
 */
export function mapTree<M extends TreeMap>(maps: readonly M[]): MapTreeNode<M>[] {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const parents = parentLinks(maps);
  const placed = new Set<MapId>();

  function node(map: M): MapTreeNode<M> {
    placed.add(map.id);
    const children = map.areas
      .map((area) => (area.map ? byId.get(area.map) : undefined))
      .filter((child): child is M => !!child && !placed.has(child.id))
      .filter((child) => parents.get(child.id)?.mapId === map.id);
    return { map, children: children.map(node) };
  }

  const roots = maps.filter((map) => !parents.has(map.id)).map(node);
  for (const map of maps) if (!placed.has(map.id)) roots.push(node(map));
  return roots;
}

/**
 * Maps an area on `mapId` may lead to: not the map itself or one of its ancestors (that would make
 * a cycle), and not a map that already has a different parent.
 */
export function attachableMaps<M extends TreeMap>(
  mapId: MapId,
  areaId: AreaId,
  maps: readonly M[],
): M[] {
  const parents = parentLinks(maps);
  const excluded = new Set([mapId, ...ancestors(mapId, maps).map((map) => map.id)]);
  return maps.filter((map) => {
    if (excluded.has(map.id)) return false;
    const parent = parents.get(map.id);
    return !parent || (parent.mapId === mapId && parent.areaId === areaId);
  });
}

/**
 * Why these maps don't form a tree, or undefined if they do: a map with two parents, or a map
 * that is its own ancestor. Links to missing maps are ignored (see `withoutMissingLinks`).
 */
export function treeProblem(maps: readonly TreeMap[]): string | undefined {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const parents = new Map<MapId, string>();
  for (const map of maps) {
    for (const area of map.areas) {
      if (!area.map || !byId.has(area.map)) continue;
      const child = byId.get(area.map)!;
      if (child.id === map.id) return `“${area.name}” leads back to its own map.`;
      const other = parents.get(child.id);
      if (other) return `“${child.name}” is already reached from “${other}”.`;
      parents.set(child.id, area.name);
    }
  }
  // Every map now has at most one parent, so following parents either ends or goes round.
  const links = parentLinks(maps);
  for (const map of maps) {
    const seen = new Set<MapId>();
    let current: TreeMap | undefined = map;
    while (current) {
      if (seen.has(current.id)) return `“${map.name}” would end up inside itself.`;
      seen.add(current.id);
      const link = links.get(current.id);
      current = link && byId.get(link.mapId);
    }
  }
  return undefined;
}

/** Drops area links to maps that no longer exist, so they show as not mapped yet. */
export function withoutMissingLinks<A extends Pick<Area, "map">>(
  areas: readonly A[],
  exists: (id: MapId) => boolean,
): A[] {
  return areas.map((area) => {
    if (!area.map || exists(area.map)) return area;
    const rest = { ...area };
    delete rest.map;
    return rest;
  });
}
