import { describe, expect, it } from "vitest";
import { moduleOf } from "./modules";

describe("moduleOf", () => {
  it("reads the part of the app from the first path segment", () => {
    expect(moduleOf("/wiki/NPCs/Someone")).toBe("wiki");
    expect(moduleOf("/characters/abc")).toBe("characters");
    expect(moduleOf("/maps/abc/edit")).toBe("maps");
    expect(moduleOf("/combat/prepared")).toBe("combat");
  });

  it("counts everything else as the hub", () => {
    expect(moduleOf("/")).toBe("hub");
    expect(moduleOf("/members")).toBe("hub");
    expect(moduleOf("/wikipedia")).toBe("hub");
  });
});
