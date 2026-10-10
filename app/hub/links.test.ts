import { describe, expect, it } from "vitest";
import { hubLinks } from "./links";

describe("hubLinks", () => {
  it("lists the wiki as an in-app module", () => {
    expect(hubLinks()).toContainEqual(expect.objectContaining({ id: "wiki", href: "/wiki" }));
  });

  it("lists characters for everyone", () => {
    for (const role of ["dm", "player"] as const) {
      expect(hubLinks(role)).toContainEqual(
        expect.objectContaining({ id: "characters", href: "/characters" }),
      );
    }
  });

  it("lists the combat tracker for the DM", () => {
    expect(hubLinks("dm")).toContainEqual(
      expect.objectContaining({ id: "combat", href: "/combat" }),
    );
  });

  it.each(["dm", "player"] as const)("lists maps for the %s", (role) => {
    expect(hubLinks(role)).toContainEqual(expect.objectContaining({ id: "maps", href: "/maps" }));
  });

  it("lists the members page for the DM", () => {
    expect(hubLinks("dm")).toContainEqual(
      expect.objectContaining({ id: "members", href: "/members" }),
    );
  });

  it("leaves DM-only modules out of the player preview", () => {
    const ids = hubLinks("player").map((m) => m.id);
    expect(ids).not.toContain("combat");
    expect(ids).not.toContain("members");
  });
});
