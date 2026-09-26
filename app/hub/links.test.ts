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
});
