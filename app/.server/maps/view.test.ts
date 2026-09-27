import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { buildArea, buildMap, link } from "~/maps/test-builders";
import type { CampaignMap, NoteLink, Point } from "~/maps/types";
import { mapView, type MapViewInput } from "./view";

const note = (id: string, title = id): NoteLink => ({
  id,
  title,
  url: `/wiki/${title}`,
  html: `<p>${title}</p>`,
  hasOwnTitle: false,
});

/** Notes that exist, by who may see them. */
const NOTES: Record<string, { link: NoteLink; players: boolean }> = {
  town: { link: note("town", "Town"), players: true },
  secret: { link: note("secret", "Secret"), players: false },
};

const FOUND = { path: "Maps/Fixture World.png", moved: false, version: "v1" };

function view(map: CampaignMap, viewer: Viewer, fields: Partial<MapViewInput> = {}) {
  return mapView({
    map,
    maps: [map],
    viewer,
    image: FOUND,
    note: (id) => {
      const found = NOTES[id];
      return found && (viewer.role === "dm" || found.players) ? found.link : undefined;
    },
    ...fields,
  });
}

const square = (size: number): Point[] => [
  [0, 0],
  [size, 0],
  [size, size],
  [0, size],
];

describe("mapView for the DM", () => {
  it("resolves the map's note, its image and its areas' links", () => {
    const town = buildMap({ id: "town", name: "Town" });
    const world = buildMap({
      id: "world",
      name: "World",
      note: "town",
      areas: [buildArea({ id: "a", name: "Gate", map: "town", note: "town" })],
    });
    expect(view(world, DM_VIEWER, { maps: [world, town] })).toEqual({
      id: "world",
      name: "World",
      size: { width: 400, height: 200 },
      image: {
        url: "/maps/world/image?v=v1",
        status: "ok",
        path: "Maps/Fixture World.png",
      },
      note: NOTES.town.link,
      noteBroken: false,
      breadcrumbs: [{ id: "world", name: "World" }],
      areas: [
        {
          id: "a",
          name: "Gate",
          outline: buildArea({ id: "a" }).outline,
          map: { id: "town", name: "Town" },
          note: NOTES.town.link,
          broken: [],
        },
      ],
    });
  });

  it("marks links that no longer lead anywhere", () => {
    const map = buildMap({
      id: "m",
      note: "deleted-note",
      areas: [buildArea({ id: "a", map: "deleted-map", note: "deleted-note" })],
    });
    const result = view(map, DM_VIEWER);
    expect(result?.noteBroken).toBe(true);
    expect(result?.areas[0]).toMatchObject({ broken: ["map", "note"] });
    expect(result?.areas[0].map).toBeUndefined();
  });

  it("says where a moved image was found", () => {
    const moved = { path: "New/Fixture World.png", moved: true, version: "v2" };
    expect(view(buildMap({ id: "m" }), DM_VIEWER, { image: moved })?.image).toEqual({
      url: "/maps/m/image?v=v2",
      status: "moved",
      path: "Maps/Fixture World.png",
      movedTo: "New/Fixture World.png",
    });
  });

  it("keeps a map whose image is missing, with no image URL", () => {
    const result = view(buildMap({ id: "m", areas: [buildArea({ id: "a" })] }), DM_VIEWER, {
      image: undefined,
    });
    expect(result?.image).toEqual({ status: "missing", path: "Maps/Fixture World.png" });
    expect(result?.areas).toHaveLength(1);
  });

  it("lists areas largest first, so nested ones are drawn on top", () => {
    const map = buildMap({
      id: "m",
      areas: [
        buildArea({ id: "building", outline: square(0.1) }),
        buildArea({ id: "district", outline: square(0.5) }),
      ],
    });
    expect(view(map, DM_VIEWER)?.areas.map((area) => area.id)).toEqual(["district", "building"]);
  });

  it("gives breadcrumbs from the outermost map down", () => {
    const world = buildMap({ id: "world", areas: [link("region")] });
    const region = buildMap({ id: "region", areas: [link("town")] });
    const town = buildMap({ id: "town" });
    const crumbs = view(town, DM_VIEWER, { maps: [world, region, town] })?.breadcrumbs;
    expect(crumbs?.map((crumb) => crumb.id)).toEqual(["world", "region", "town"]);
  });
});

describe("mapView for players", () => {
  const shown = { visibility: "players" as const };

  it("treats a hidden map exactly like a missing one", () => {
    expect(view(buildMap({ id: "m" }), PLAYER_VIEWER)).toBeUndefined();
  });

  it("drops hidden areas entirely", () => {
    const map = buildMap({
      id: "m",
      ...shown,
      areas: [buildArea({ id: "revealed", ...shown }), buildArea({ id: "secret" })],
    });
    expect(view(map, PLAYER_VIEWER)?.areas.map((area) => area.id)).toEqual(["revealed"]);
  });

  it("makes a revealed area whose targets are hidden look like one that leads nowhere yet", () => {
    const hiddenChild = buildMap({ id: "lair" });
    const map = buildMap({
      id: "m",
      ...shown,
      areas: [
        buildArea({ id: "a", ...shown, map: "lair", note: "secret" }),
        buildArea({ id: "b", ...shown }),
      ],
    });
    const [withHiddenTargets, leadingNowhere] = view(map, PLAYER_VIEWER, {
      maps: [map, hiddenChild],
    })!.areas;
    expect({ ...withHiddenTargets, id: "b", name: "b" }).toEqual(leadingNowhere);
  });

  it("keeps links to maps and notes the players can see", () => {
    const child = buildMap({ id: "town", name: "Town", ...shown });
    const map = buildMap({
      id: "m",
      ...shown,
      areas: [buildArea({ id: "a", ...shown, map: "town", note: "town" })],
    });
    expect(view(map, PLAYER_VIEWER, { maps: [map, child] })?.areas[0]).toMatchObject({
      map: { id: "town" },
      note: NOTES.town.link,
    });
  });

  it("never tells players about broken links or image files", () => {
    const map = buildMap({
      id: "m",
      ...shown,
      note: "deleted-note",
      areas: [buildArea({ id: "a", ...shown, map: "deleted-map" })],
    });
    const moved = { path: "New/Fixture World.png", moved: true, version: "v2" };
    const result = view(map, PLAYER_VIEWER, { image: moved });
    expect(result?.noteBroken).toBe(false);
    expect(result?.areas[0].broken).toEqual([]);
    expect(result?.image).toEqual({ url: "/maps/m/image?v=v2", status: "ok" });
    expect(view(map, PLAYER_VIEWER, { image: undefined })?.image).toEqual({ status: "missing" });
  });

  it("starts breadcrumbs below the innermost hidden ancestor", () => {
    const world = buildMap({ id: "world", ...shown, areas: [link("region")] });
    const region = buildMap({ id: "region", areas: [link("town")] });
    const town = buildMap({ id: "town", ...shown });
    const crumbs = view(town, PLAYER_VIEWER, { maps: [world, region, town] })?.breadcrumbs;
    expect(crumbs?.map((crumb) => crumb.id)).toEqual(["town"]);
  });
});
