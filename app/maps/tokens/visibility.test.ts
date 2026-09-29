import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import type { FogMask } from "../fog/types";
import { aCharacterToken, aMarker } from "./test-builders";
import type { Token } from "./types";
import { tokensForViewer, type PartyMember } from "./visibility";

/** Two cells side by side: the left one revealed, the right one under the fog. */
const fog: FogMask = { cols: 2, rows: 1, cells: Uint8Array.from([1, 0]) };
const LIT: [number, number] = [0.25, 0.5];
const DARK: [number, number] = [0.75, 0.5];

const playerOne: Viewer = { role: "player", playerId: "player one" };
const party: Record<string, PartyMember> = {
  "Party/One": {
    name: "One",
    portraitUrl: "/characters/1/portrait?v=x",
    controllers: { players: ["player one"] },
  },
  "Party/Two": { name: "Two", controllers: { players: ["player two"] } },
  "Party/Dog": { name: "Dog", controllers: "party" },
  "Party/Gone": { name: "Gone", controllers: "unknown" },
};

const view = (viewer: Viewer, tokens: Token[]) =>
  tokensForViewer({ tokens, viewer, fog, party: (note) => party[note] });
const ids = (viewer: Viewer, tokens: Token[]) => view(viewer, tokens).map((token) => token.id);

describe("tokensForViewer", () => {
  const pc = (note: string, at = LIT) => aCharacterToken({ id: note, note, at });

  describe("markers", () => {
    const shown = aMarker({ id: "shown", visibility: "players", at: LIT });
    const shownInTheDark = aMarker({ id: "shown-dark", visibility: "players", at: DARK });
    const secret = aMarker({ id: "secret", visibility: "dm", at: LIT });

    it("shows players a marker the DM shows them, where it's revealed", () => {
      expect(view(playerOne, [shown])).toEqual([
        {
          id: "shown",
          kind: "marker",
          at: LIT,
          name: "Fixture marker",
          colour: "red",
          movable: false,
        },
      ]);
    });

    it("leaves out, for players, a DM-only marker, and a shown one under the fog", () => {
      expect(ids(playerOne, [secret, shownInTheDark])).toEqual([]);
    });

    it("gives the DM every marker, with what players can't see of it", () => {
      const views = view(DM_VIEWER, [shown, shownInTheDark, secret]);
      expect(views.map(({ id, hidden, movable }) => ({ id, hidden, movable }))).toEqual([
        { id: "shown", hidden: undefined, movable: true },
        { id: "shown-dark", hidden: "fog", movable: true },
        { id: "secret", hidden: "secret", movable: true },
      ]);
      expect(views[2].visibility).toBe("dm");
    });
  });

  describe("party members", () => {
    it("shows a player their own PC and the companion even under the fog, as in the dark", () => {
      const views = view(playerOne, [pc("Party/One", DARK), pc("Party/Dog", DARK)]);
      expect(views.map(({ name, movable, inTheDark }) => ({ name, movable, inTheDark }))).toEqual([
        { name: "One", movable: true, inTheDark: true },
        { name: "Dog", movable: true, inTheDark: true },
      ]);
    });

    it("shows a player other PCs only where it's revealed, and never lets them move them", () => {
      expect(view(playerOne, [pc("Party/Two", LIT)])).toEqual([
        { id: "Party/Two", kind: "character", at: LIT, name: "Two", movable: false },
      ]);
      expect(ids(playerOne, [pc("Party/Two", DARK)])).toEqual([]);
    });

    it("carries the portrait only when there is one", () => {
      expect(view(playerOne, [pc("Party/One")])[0].portraitUrl).toBe("/characters/1/portrait?v=x");
      expect(view(playerOne, [pc("Party/Two")])[0]).not.toHaveProperty("portraitUrl");
    });

    it("leaves out party members the viewer may not know of: note gone, or unknown", () => {
      expect(ids(playerOne, [pc("Party/Gone"), pc("Party/Nobody")])).toEqual([]);
      expect(ids(DM_VIEWER, [pc("Party/Nobody")])).toEqual([]);
    });

    it("gives the DM every party member, movable, marking those under the fog", () => {
      const views = view(DM_VIEWER, [pc("Party/Two", DARK), pc("Party/Gone", LIT)]);
      expect(views.map(({ id, hidden, movable }) => ({ id, hidden, movable }))).toEqual([
        { id: "Party/Two", hidden: "fog", movable: true },
        { id: "Party/Gone", hidden: undefined, movable: true },
      ]);
    });

    it("shows the DM previewing as a player what an unassigned player sees", () => {
      const views = view(PLAYER_VIEWER, [
        pc("Party/One", LIT),
        pc("Party/Two", DARK),
        pc("Party/Dog", DARK),
      ]);
      expect(views.map(({ id, movable }) => ({ id, movable }))).toEqual([
        { id: "Party/One", movable: false },
        { id: "Party/Dog", movable: true },
      ]);
    });
  });

  it("never gives players DM-only details, whatever the token", () => {
    const tokens = [
      aMarker({ id: "m", visibility: "players", at: LIT }),
      pc("Party/One", DARK),
      pc("Party/Two", LIT),
    ];
    for (const token of view(playerOne, tokens)) {
      expect(token).not.toHaveProperty("hidden");
      expect(token).not.toHaveProperty("visibility");
    }
  });
});
