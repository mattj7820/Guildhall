import { describe, expect, it } from "vitest";
import { buildArea, buildMap, link } from "./test-builders";
import {
  ancestors,
  attachableMaps,
  descendants,
  mapTree,
  parentLinks,
  treeProblem,
  withoutMissingLinks,
} from "./tree";
import type { CampaignMap } from "./types";

/** world → region → town, plus a separate dungeon map. */
const world = buildMap({ id: "world", areas: [link("region")] });
const region = buildMap({ id: "region", areas: [link("town")] });
const town = buildMap({ id: "town" });
const dungeon = buildMap({ id: "dungeon" });
const maps = [world, region, town, dungeon];

const ids = (list: { id: string }[]) => list.map((map) => map.id);

describe("parentLinks", () => {
  it("finds each map's parent map and area", () => {
    expect(parentLinks(maps).get("town")).toEqual({ mapId: "region", areaId: "to-town" });
    expect(parentLinks(maps).has("world")).toBe(false);
  });

  it("ignores links to maps that don't exist", () => {
    expect(parentLinks([buildMap({ id: "a", areas: [link("gone")] })]).size).toBe(0);
  });
});

describe("descendants", () => {
  it("lists every map inside, at any depth", () => {
    expect(descendants("world", maps)).toEqual(["region", "town"]);
    expect(descendants("region", maps)).toEqual(["town"]);
  });

  it("is empty for a map with none, or one that doesn't exist", () => {
    expect(descendants("town", maps)).toEqual([]);
    expect(descendants("nowhere", maps)).toEqual([]);
  });

  it("stops at a cycle in a hand-edited file", () => {
    const a = buildMap({ id: "a", areas: [link("b")] });
    const b = buildMap({ id: "b", areas: [link("a")] });
    expect(descendants("a", [a, b])).toEqual(["b"]);
  });
});

describe("ancestors", () => {
  it("lists the way back up, outermost first", () => {
    expect(ids(ancestors("town", maps))).toEqual(["world", "region"]);
  });

  it("is empty for a top-level map, or one that doesn't exist", () => {
    expect(ancestors("world", maps)).toEqual([]);
    expect(ancestors("nowhere", maps)).toEqual([]);
  });

  it("stops at a cycle in a hand-edited file", () => {
    const a = buildMap({ id: "a", areas: [link("b")] });
    const b = buildMap({ id: "b", areas: [link("a")] });
    expect(ids(ancestors("a", [a, b]))).toEqual(["b"]);
  });
});

describe("mapTree", () => {
  const shape = (nodes: ReturnType<typeof mapTree>): unknown =>
    nodes.map((node) => [node.map.id, shape(node.children)]);

  it("nests maps under the maps whose areas lead to them", () => {
    expect(shape(mapTree(maps))).toEqual([
      ["world", [["region", [["town", []]]]]],
      ["dungeon", []],
    ]);
  });

  it("still lists every map when a hand-edited file has a cycle", () => {
    const a = buildMap({ id: "a", areas: [link("b")] });
    const b = buildMap({ id: "b", areas: [link("a")] });
    expect(shape(mapTree([a, b]))).toEqual([["a", [["b", []]]]]);
  });

  it("lists a map once when a hand-edited file gives it two parents", () => {
    const a = buildMap({ id: "a", areas: [link("c", "first")] });
    const b = buildMap({ id: "b", areas: [link("c", "second")] });
    const c = buildMap({ id: "c" });
    expect(shape(mapTree([a, b, c]))).toEqual([
      ["a", [["c", []]]],
      ["b", []],
    ]);
  });
});

describe("attachableMaps", () => {
  it("offers maps with no parent, but not the map itself or its ancestors", () => {
    expect(ids(attachableMaps("town", "new-area", maps))).toEqual(["dungeon"]);
  });

  it("offers the map this area already leads to", () => {
    expect(ids(attachableMaps("region", "to-town", maps))).toEqual(["town", "dungeon"]);
  });

  it("doesn't offer a map another area already leads to", () => {
    expect(ids(attachableMaps("region", "another-area", maps))).toEqual(["dungeon"]);
  });
});

describe("treeProblem", () => {
  it("accepts a tree", () => {
    expect(treeProblem(maps)).toBeUndefined();
  });

  it("refuses a second way into a map, naming the first", () => {
    const withTwo: CampaignMap[] = [
      { ...world, areas: [...world.areas, buildArea({ id: "x", name: "Shortcut", map: "town" })] },
      region,
      town,
    ];
    expect(treeProblem(withTwo)).toBe("“town” is already reached from “Shortcut”.");
  });

  it("refuses an area leading to its own map", () => {
    const loop = buildMap({ id: "a", areas: [buildArea({ id: "x", name: "Here", map: "a" })] });
    expect(treeProblem([loop])).toBe("“Here” leads back to its own map.");
  });

  it("refuses a map inside its own descendant", () => {
    const withCycle = [{ ...town, areas: [link("world")] }, world, region];
    expect(treeProblem(withCycle)).toMatch(/would end up inside itself/);
  });

  it("ignores links to maps that no longer exist", () => {
    expect(treeProblem([buildMap({ id: "a", areas: [link("gone")] })])).toBeUndefined();
  });
});

describe("withoutMissingLinks", () => {
  it("drops links to deleted maps and keeps the rest of the area", () => {
    const areas = [link("region"), buildArea({ id: "x", map: "gone", note: "some-note" })];
    const kept = withoutMissingLinks(areas, (id) => id === "region");
    expect(kept[0]).toBe(areas[0]);
    expect(kept[1]).toEqual({ ...areas[1], map: undefined });
    expect("map" in kept[1]).toBe(false);
  });
});
