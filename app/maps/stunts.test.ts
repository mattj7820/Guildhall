import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import { stuntEventSchema, stuntSeenBy, type Stunt } from "./stunts";

describe("stuntSeenBy", () => {
  const visible = (token: string) => token === "shown";

  it("shows players a stunt anywhere on the map, under the fog too", () => {
    const impact: Stunt = { kind: "impact", at: [0.9, 0.9], size: 0.1 };
    expect(stuntSeenBy(impact, PLAYER_VIEWER, visible)).toBe(true);
    expect(stuntSeenBy({ kind: "shake" }, PLAYER_VIEWER, visible)).toBe(true);
    expect(stuntSeenBy({ kind: "sound", sound: "Roar.mp3" }, PLAYER_VIEWER, visible)).toBe(true);
  });

  it("shows players a token's stunt only if they can see the token", () => {
    expect(stuntSeenBy({ kind: "glow", token: "shown" }, PLAYER_VIEWER, visible)).toBe(true);
    expect(stuntSeenBy({ kind: "glow", token: "hidden" }, PLAYER_VIEWER, visible)).toBe(false);
    expect(stuntSeenBy({ kind: "fall", token: "hidden" }, DM_VIEWER, visible)).toBe(true);
  });
});

describe("stuntEventSchema", () => {
  it("takes stunts on the map, on tokens, the shake and sounds", () => {
    for (const stunt of [
      { id: "a", kind: "smoke", at: [0.5, 0.5], size: 0.2 },
      { id: "b", kind: "glow", token: "t1", light: 0.3 },
      { id: "c", kind: "stand" },
      { id: "d", kind: "sound", sound: "Doors/Creak.mp3" },
    ]) {
      expect(stuntEventSchema.safeParse(stunt).success, JSON.stringify(stunt)).toBe(true);
    }
  });

  it("refuses stunts off the map, of unknown kinds, or without an ID", () => {
    for (const stunt of [
      { id: "a", kind: "impact", at: [1.5, 0.5], size: 0.2 },
      { id: "b", kind: "fire", at: [0.5, 0.5], size: 0.2 },
      { kind: "shake" },
      { id: "c", kind: "wobble" },
    ]) {
      expect(stuntEventSchema.safeParse(stunt).success, JSON.stringify(stunt)).toBe(false);
    }
  });
});
