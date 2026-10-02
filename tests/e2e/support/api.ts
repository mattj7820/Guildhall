import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import {
  IMAGES,
  ORIGIN,
  uniqueName,
  type FixtureImage,
  type FogChange,
  type MapRef,
} from "./test-data";

/**
 * Requests straight to Guildhall's endpoints, as whoever the request context is signed in as
 * (the test's own page's `request` shares its cookies). For setting things up quickly when the
 * UI isn't what's under test, and for checking what the server refuses. Every post carries
 * Guildhall's own Origin, as the browser would.
 */
export class Api {
  constructor(readonly request: APIRequestContext) {}

  post(path: string, data: object) {
    return this.request.post(path, { headers: { Origin: ORIGIN }, data });
  }

  postForm(path: string, form: Record<string, string>) {
    return this.request.post(path, { headers: { Origin: ORIGIN }, form, maxRedirects: 0 });
  }

  /* Maps */

  /**
   * Makes a map as the DM, as the "New map" form would (`maps.spec.ts` tests the form itself).
   * Optionally shares it, changes its fog and gives it a battle grid.
   */
  async createMap({
    image = IMAGES.fog,
    name = uniqueName("Map"),
    note,
    shared = false,
    fog = [],
    grid,
  }: {
    image?: FixtureImage;
    name?: string;
    note?: string;
    shared?: boolean;
    fog?: FogChange[];
    grid?: object;
  } = {}): Promise<MapRef> {
    const response = await this.postForm("/maps", {
      image: `Maps/${image.file}`,
      width: String(image.width),
      height: String(image.height),
      name,
      note: note ?? "",
    });
    expect(response.status(), await describe(response)).toBe(302);
    const [, id] = /^\/maps\/([^/]+)\/edit$/.exec(response.headers()["location"] ?? "") ?? [];
    expect(id, "the new map's address").toBeTruthy();
    const map = { id, url: `/maps/${id}`, name, image };
    if (shared) await this.share(map);
    if (fog.length > 0) await this.changeFog(map, ...fog);
    if (grid) await this.saveMap(map, { grid });
    return map;
  }

  async share(map: MapRef, shared = true) {
    await ok(
      this.post(`${map.url}/edit`, {
        intent: "setVisibility",
        visibility: shared ? "players" : "dm",
      }),
    );
  }

  changeFogRequest(map: MapRef, ...changes: FogChange[]) {
    return this.post(`${map.url}/fog`, { changes });
  }

  async changeFog(map: MapRef, ...changes: FogChange[]) {
    return ok(this.changeFogRequest(map, ...changes));
  }

  /** Saves the map's areas and grid, as the editor does. */
  async saveMap(map: MapRef, { areas = [], grid }: { areas?: object[]; grid?: object }) {
    await ok(this.post(`${map.url}/edit`, { intent: "save", name: map.name, areas, grid }));
  }

  tokensRequest(map: MapRef, actions: object[]) {
    return this.post(`${map.url}/tokens`, { actions });
  }

  /** The map's tokens as this viewer may see them, by name. */
  async tokens(map: MapRef): Promise<{ id: string; name: string }[]> {
    // A change that can't be made still answers with the map's tokens.
    const response = await this.tokensRequest(map, [{ type: "move", id: "none", to: [0, 0] }]);
    return (await response.json()).tokens;
  }

  /** Places a DM marker at a point on the map. */
  async placeMarker(map: MapRef, name: string, at: [number, number], visibility = "dm") {
    const token = { kind: "marker", id: name, map: map.id, at, name, colour: "green", visibility };
    await ok(this.tokensRequest(map, [{ type: "place", token }]));
  }

  /* The fight */

  async endFight() {
    await ok(this.post("/combat/fight", { intent: "end" }));
  }

  async fight() {
    return (await (await this.request.get("/combat/fight")).json()).fight;
  }
}

/** Expects a request to succeed, saying what the server answered if it didn't. */
export async function ok(pending: Promise<APIResponse>) {
  const response = await pending;
  expect(response.status(), await describe(response)).toBe(200);
  return response;
}

async function describe(response: APIResponse) {
  const body = await response.text().catch(() => "");
  return `${response.url()} answered ${response.status()}: ${body.slice(0, 200)}`;
}
