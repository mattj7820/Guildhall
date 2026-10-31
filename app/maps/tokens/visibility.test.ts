import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import type { FogMask } from "../fog/types";
import { encounter, monster, player } from "~/combat/test-builders";
import { aCharacterToken, aMarker } from "./test-builders";
import type { MarkerToken, Token } from "./types";
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

    it("leaves out a marker set aside, for the DM too", () => {
      const aside = aMarker({ id: "aside", visibility: "players", at: LIT, aside: true });
      expect(ids(DM_VIEWER, [aside, shown])).toEqual(["shown"]);
      expect(ids(playerOne, [aside, shown])).toEqual(["shown"]);
    });

    it("shows players a marker the DM shows them, where it's revealed", () => {
      expect(view(playerOne, [shown])).toEqual([
        {
          id: "shown",
          kind: "marker",
          at: LIT,
          size: 1,
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

  describe("NPCs", () => {
    const pictureOf = (token: MarkerToken) =>
      token.note === "NPCs/Secret Villain"
        ? `/maps/world/tokens/${token.id}/picture?v=1`
        : undefined;
    const npcView = (viewer: Viewer, tokens: Token[]) =>
      tokensForViewer({ tokens, viewer, fog, party: () => undefined, pictureOf });
    const disguised = aMarker({
      id: "stranger",
      name: "Hooded figure",
      note: "NPCs/Secret Villain",
      picture: "note",
      icon: "hood",
      visibility: "players",
      at: LIT,
    });

    it("shows players a shown NPC by its own name and picture, and nothing of its note", () => {
      const [seen] = npcView(playerOne, [disguised]);
      expect(seen).toEqual({
        id: "stranger",
        kind: "marker",
        at: LIT,
        size: 1,
        name: "Hooded figure",
        colour: "red",
        portraitUrl: "/maps/world/tokens/stranger/picture?v=1",
        movable: false,
      });
      expect(JSON.stringify(seen)).not.toMatch(/Secret Villain|hood"/);
    });

    it("gives players nothing at all of a DM-only NPC, or one under the fog", () => {
      const hidden = { ...disguised, visibility: "dm" as const };
      const dark = { ...disguised, id: "dark", at: DARK };
      expect(npcView(playerOne, [hidden, dark])).toEqual([]);
    });

    it("draws the icon when that's the picture, and initials when the note has no image", () => {
      const icon = { ...disguised, picture: "icon" as const };
      const noImage = aMarker({
        id: "plain",
        note: "NPCs/Other",
        picture: "note",
        at: LIT,
        visibility: "players",
      });
      const [withIcon, initials] = npcView(playerOne, [icon, noImage]);
      expect(withIcon.icon).toBe("hood");
      expect(withIcon.portraitUrl).toBeUndefined();
      expect(initials.icon).toBeUndefined();
      expect(initials.portraitUrl).toBeUndefined();
    });

    it("gives the DM the NPC's note and picture settings, for its form", () => {
      const [seen] = npcView(DM_VIEWER, [disguised]);
      expect(seen.marker).toEqual({ note: "NPCs/Secret Villain", picture: "note", icon: "hood" });
      expect(seen.portraitUrl).toBe("/maps/world/tokens/stranger/picture?v=1");
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
        { id: "Party/Two", kind: "character", at: LIT, size: 1, name: "Two", movable: false },
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

    it("gives the DM every party member, movable, with their note, marking those under the fog", () => {
      const views = view(DM_VIEWER, [pc("Party/Two", DARK), pc("Party/Gone", LIT)]);
      expect(views.map(({ note, hidden, movable }) => ({ note, hidden, movable }))).toEqual([
        { note: "Party/Two", hidden: "fog", movable: true },
        { note: "Party/Gone", hidden: undefined, movable: true },
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

  describe("monsters in the fight", () => {
    const fight = {
      revision: 1,
      encounter: encounter([
        monster("Goblin 1", { hp: { current: 4, max: 7, temp: 0 } }),
        monster("Goblin 2", { hp: { current: 0, max: 7, temp: 0 } }),
        monster("Ambusher", { hidden: true }),
        player("One", { entityId: "Party/One" }),
      ]),
    };
    const token = (combatant: string, at = LIT): Token => ({
      kind: "combatant",
      id: `t-${combatant}`,
      map: "world",
      at,
      combatant,
    });
    const seen = (viewer: Viewer, ...tokens: Token[]) =>
      tokensForViewer({ tokens, viewer, fog, party: (note) => party[note], fight });

    it("names a monster's token from the fight, and says when it's down", () => {
      const [goblin, down] = seen(playerOne, token("Goblin 1"), token("Goblin 2"));
      expect(goblin).toMatchObject({ name: "Goblin 1", combatant: "Goblin 1", movable: false });
      expect(goblin).not.toHaveProperty("down");
      expect(down).toMatchObject({ name: "Goblin 2", down: true });
    });

    it("gives the DM its hit points, and nobody else", () => {
      expect(seen(DM_VIEWER, token("Goblin 1"))[0].hp).toEqual({ current: 4, max: 7 });
      expect(seen(playerOne, token("Goblin 1"))[0]).not.toHaveProperty("hp");
    });

    it("leaves out, for players, a hidden monster and one under the fog", () => {
      expect(seen(playerOne, token("Ambusher"), token("Goblin 1", DARK))).toEqual([]);
      expect(seen(DM_VIEWER, token("Ambusher"))[0].hidden).toBe("secret");
    });

    it("leaves out, for players, a token whose monster isn't in the fight", () => {
      expect(seen(playerOne, token("Gone"))).toEqual([]);
      expect(seen(DM_VIEWER, token("Gone"))[0]).toMatchObject({ name: "Not in the fight" });
    });

    it("links a party member's token to their place in the fight", () => {
      expect(seen(playerOne, pc("Party/One"))[0].combatant).toBe("One");
    });

    describe("markers in the fight", () => {
      const goblin = { entityId: "srd-goblin", name: "Goblin", source: "srd-5.2" as const };
      const marker = (combatant: string, fields: Partial<MarkerToken> = {}) =>
        aMarker({
          id: `m-${combatant}`,
          at: LIT,
          name: "Snaggletooth",
          colour: "green",
          statblock: goblin,
          combatant,
          ...fields,
        });

      it("keeps its own name and look, linked to its combatant", () => {
        expect(seen(playerOne, marker("Goblin 1", { visibility: "players" }))).toEqual([
          {
            id: "m-Goblin 1",
            kind: "marker",
            at: LIT,
            size: 1,
            name: "Snaggletooth",
            colour: "green",
            movable: false,
            combatant: "Goblin 1",
          },
        ]);
      });

      it("is hidden or shown as its monster is, whatever the marker said before", () => {
        // The fight's hiding is the one switch while it's in the fight.
        expect(seen(playerOne, marker("Goblin 1", { visibility: "dm" }))).toHaveLength(1);
        expect(seen(playerOne, marker("Ambusher", { visibility: "players" }))).toEqual([]);
        expect(seen(DM_VIEWER, marker("Ambusher"))[0]).toMatchObject({
          hidden: "secret",
          visibility: "dm",
        });
      });

      it("takes its hit points from the fight, for the DM, and is down at 0 for everyone", () => {
        const kept = { hp: { current: 9, max: 9 }, visibility: "players" as const };
        expect(seen(DM_VIEWER, marker("Goblin 1", kept))[0].hp).toEqual({ current: 4, max: 7 });
        const [down] = seen(playerOne, marker("Goblin 2", kept));
        expect(down).toMatchObject({ down: true, colour: "green" });
        expect(down).not.toHaveProperty("hp");
      });

      it("is a plain marker again once its combatant isn't in the fight", () => {
        const left = marker("Gone", { visibility: "players", hp: { current: 0, max: 7 } });
        const [token] = seen(playerOne, left);
        expect(token).not.toHaveProperty("combatant");
        expect(token).toMatchObject({ name: "Snaggletooth", down: true });
        expect(seen(DM_VIEWER, left)[0]).toMatchObject({
          hp: { current: 0, max: 7 },
          marker: { statblock: goblin },
        });
      });
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
      expect(token).not.toHaveProperty("note");
    }
  });
});
