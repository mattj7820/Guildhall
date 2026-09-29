import { describe, expect, it } from "vitest";
import { hubLinks } from "./links";

describe("hubLinks", () => {
  it("links to the configured Roll20 campaign", () => {
    const url = "https://app.roll20.net/campaigns/details/1/test";
    const roll20 = hubLinks({ roll20CampaignUrl: url }).tools.find((t) => t.id === "roll20");
    expect(roll20).toMatchObject({ href: url, external: true });
  });

  it("keeps Roll20 on the page with a setup hint when it isn't configured", () => {
    const roll20 = hubLinks({}).tools.find((t) => t.id === "roll20");
    expect(roll20?.href).toBeUndefined();
    expect(roll20?.setupHint).toMatch(/ROLL20_CAMPAIGN_URL/);
  });

  it("lists the wiki as an in-app module", () => {
    expect(hubLinks({}).modules).toContainEqual(
      expect.objectContaining({ id: "wiki", href: "/wiki", external: false }),
    );
  });

  it("lists characters for everyone", () => {
    for (const role of ["dm", "player"] as const) {
      expect(hubLinks({}, role).modules).toContainEqual(
        expect.objectContaining({ id: "characters", href: "/characters", external: false }),
      );
    }
  });

  it("lists the combat tracker for the DM", () => {
    expect(hubLinks({}, "dm").modules).toContainEqual(
      expect.objectContaining({ id: "combat", href: "/combat", external: false }),
    );
  });

  it.each(["dm", "player"] as const)("lists maps for the %s", (role) => {
    expect(hubLinks({}, role).modules).toContainEqual(
      expect.objectContaining({ id: "maps", href: "/maps", external: false }),
    );
  });

  it("lists the members page for the DM", () => {
    expect(hubLinks({}, "dm").modules).toContainEqual(
      expect.objectContaining({ id: "members", href: "/members" }),
    );
  });

  it("leaves DM-only modules out of the player preview", () => {
    const ids = hubLinks({}, "player").modules.map((m) => m.id);
    expect(ids).not.toContain("combat");
    expect(ids).not.toContain("members");
  });
});
