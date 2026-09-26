import { describe, expect, it } from "vitest";
import { parseByteRange } from "./http-range";

describe("parseByteRange", () => {
  const size = 1000;

  it.each([
    ["bytes=0-99", { start: 0, end: 99 }],
    ["bytes=100-", { start: 100, end: 999 }],
    ["bytes=-100", { start: 900, end: 999 }],
    ["bytes=900-5000", { start: 900, end: 999 }],
    ["bytes=-5000", { start: 0, end: 999 }],
  ])("parses %s", (header, expected) => {
    expect(parseByteRange(header, size)).toEqual(expected);
  });

  it.each([null, "", "bytes=-", "items=0-5", "bytes=0-1,5-6", "bytes=abc"])(
    "serves the whole file for %j",
    (header) => {
      expect(parseByteRange(header, size)).toBeUndefined();
    },
  );

  it.each(["bytes=1000-", "bytes=500-100", "bytes=-0"])("rejects %s as unsatisfiable", (header) => {
    expect(parseByteRange(header, size)).toBe("unsatisfiable");
  });
});
