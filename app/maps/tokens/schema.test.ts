import { describe, expect, it } from "vitest";
import { tokenActionsSchema, tokenSchema, tokensSchema } from "./schema";
import { aCharacterToken, aMarker } from "./test-builders";

describe("tokenSchema", () => {
  it("accepts party members and markers", () => {
    expect(tokenSchema.parse(aCharacterToken())).toEqual(aCharacterToken());
    expect(tokenSchema.parse(aMarker())).toEqual(aMarker());
  });

  it.each([
    ["missing", undefined],
    ["unrecognised", "everyone"],
  ])("makes a marker with %s visibility DM-only", (_name, visibility) => {
    const parsed = tokenSchema.parse({ ...aMarker(), visibility });
    expect(parsed.kind === "marker" && parsed.visibility).toBe("dm");
  });

  it("loads a marker stored before NPCs exactly as it was", () => {
    const stored = {
      kind: "marker",
      id: "m",
      map: "world",
      at: [0.1, 0.2],
      name: "Inn",
      colour: "blue",
      visibility: "players",
      size: 2,
    };
    expect(tokenSchema.parse(stored)).toEqual(stored);
  });

  it("keeps an NPC's note, picture, icon and being set aside", () => {
    const npc = aMarker({ note: "NPCs/Mira", picture: "note", icon: "hood", aside: true });
    expect(tokenSchema.parse(npc)).toEqual(npc);
  });

  it.each([
    ["note", { note: "" }],
    ["picture", { picture: "photo" }],
    ["icon", { icon: 7 }],
    ["aside", { aside: "yes" }],
  ])("drops an unreadable %s rather than refusing the marker", (field, fields) => {
    const parsed = tokenSchema.parse({ ...aMarker(), ...fields });
    expect(parsed).toEqual(aMarker());
    expect((parsed as unknown as Record<string, unknown>)[field]).toBeUndefined();
  });

  it.each([
    ["a point off the image", { ...aMarker(), at: [1.2, 0.5] }],
    ["an unknown colour", { ...aMarker(), colour: "gold" }],
    ["a blank name", { ...aMarker(), name: "  " }],
    ["a very long name", { ...aMarker(), name: "x".repeat(61) }],
    ["an unknown kind", { ...aMarker(), kind: "monster" }],
    ["a party member with no note", { ...aCharacterToken(), note: "" }],
    ["a size that isn't 1 to 4 squares", { ...aMarker(), size: 5 }],
  ])("refuses %s", (_name, token) => {
    expect(tokenSchema.safeParse(token).success).toBe(false);
  });
});

describe("tokensSchema", () => {
  it("refuses two tokens with the same ID", () => {
    expect(tokensSchema.safeParse([aMarker({ id: "a" }), aMarker({ id: "a" })]).success).toBe(
      false,
    );
  });

  it("refuses a party member in two places", () => {
    const twice = [aCharacterToken({ id: "a" }), aCharacterToken({ id: "b", map: "keep" })];
    expect(tokensSchema.safeParse(twice).success).toBe(false);
  });
});

describe("tokenActionsSchema", () => {
  it("accepts a batch of actions", () => {
    const actions = [
      { type: "move", id: "a", to: [0.1, 0.2], from: [0.3, 0.4] },
      { type: "place", token: aMarker() },
      { type: "remove", id: "a" },
      { type: "editMarker", id: "a", colour: "blue" },
      { type: "editMarker", id: "a", note: null, picture: "icon", icon: "hood" },
      { type: "setAside", id: "a" },
    ];
    expect(tokenActionsSchema.parse(actions)).toEqual(actions);
  });

  it.each([
    ["no actions", []],
    ["too many actions", Array.from({ length: 51 }, () => ({ type: "remove", id: "a" }))],
    ["an unknown action", [{ type: "teleport", id: "a" }]],
    ["a move off the image", [{ type: "move", id: "a", to: [-0.1, 0.5] }]],
  ])("refuses %s", (_name, actions) => {
    expect(tokenActionsSchema.safeParse(actions).success).toBe(false);
  });
});
