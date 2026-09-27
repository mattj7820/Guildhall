import { describe, expect, it } from "vitest";
import { campaignMapSchema, mapChangesSchema } from "./schema";
import { buildArea, buildMap } from "./test-builders";

describe("campaignMapSchema", () => {
  it("accepts a map with areas", () => {
    const map = buildMap({ id: "m", note: "location-town", areas: [buildArea({ id: "a" })] });
    expect(campaignMapSchema.parse(map)).toEqual(map);
  });

  it.each([undefined, "everyone", "PLAYERS"])(
    "fails closed to DM-only for visibility %j",
    (visibility) => {
      const raw = { ...buildMap({ id: "m" }), visibility };
      const area = { ...buildArea({ id: "a" }), visibility };
      const parsed = campaignMapSchema.parse({ ...raw, areas: [area] });
      expect(parsed.visibility).toBe("dm");
      expect(parsed.areas[0].visibility).toBe("dm");
    },
  );

  it.each([
    [
      "fewer than three points",
      [
        [0, 0],
        [1, 1],
      ],
    ],
    [
      "a point off the image",
      [
        [0, 0],
        [1.2, 0],
        [0, 1],
      ],
    ],
    [
      "a negative coordinate",
      [
        [0, -0.1],
        [1, 0],
        [0, 1],
      ],
    ],
  ])("refuses an outline with %s", (_name, outline) => {
    const map = { ...buildMap({ id: "m" }), areas: [{ ...buildArea({ id: "a" }), outline }] };
    expect(campaignMapSchema.safeParse(map).success).toBe(false);
  });

  it("refuses two areas with the same ID", () => {
    const map = buildMap({ id: "m", areas: [buildArea({ id: "a" }), buildArea({ id: "a" })] });
    expect(campaignMapSchema.safeParse(map).success).toBe(false);
  });

  it.each([
    ["a zero width", { path: "x.png", width: 0, height: 10 }],
    ["a fractional height", { path: "x.png", width: 10, height: 1.5 }],
    ["an empty path", { path: " ", width: 10, height: 10 }],
  ])("refuses an image with %s", (_name, image) => {
    expect(campaignMapSchema.safeParse({ ...buildMap({ id: "m" }), image }).success).toBe(false);
  });

  it("refuses an over-long name", () => {
    expect(campaignMapSchema.safeParse(buildMap({ id: "m", name: "x".repeat(101) })).success).toBe(
      false,
    );
  });
});

describe("mapChangesSchema", () => {
  it("accepts what the editor saves", () => {
    const { name, image, areas } = buildMap({ id: "m", areas: [buildArea({ id: "a" })] });
    expect(mapChangesSchema.safeParse({ name, image, areas, note: "x" }).success).toBe(true);
  });

  it("refuses an empty note ID rather than storing a link to nothing", () => {
    const { name, image, areas } = buildMap({ id: "m" });
    expect(mapChangesSchema.safeParse({ name, image, areas, note: "" }).success).toBe(false);
  });
});
