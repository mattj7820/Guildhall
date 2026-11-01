import { describe, expect, it } from "vitest";
import { boardFileSchema } from "./schema";

describe("boardFileSchema", () => {
  it("keeps what it can read of a damaged board, and never refuses it", () => {
    const parsed = boardFileSchema.parse({
      version: 1,
      cards: [
        { id: "a", kind: "text", text: "Fixture", shown: "yes", by: { dm: true }, x: 2, y: -1 },
        { id: "b", kind: "mystery" },
      ],
      strings: "not a list",
    });
    expect(parsed.cards).toEqual([
      { id: "a", kind: "text", text: "Fixture", shown: false, by: { dm: true }, x: 1, y: 0 },
    ]);
    expect(parsed.strings).toEqual([]);
  });
});
