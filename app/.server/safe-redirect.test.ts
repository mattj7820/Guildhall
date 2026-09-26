import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it.each(["/", "/wiki", "/wiki/NPCs/Mira%20Stonehand?q=x#top"])(
    "allows the local path %s",
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    },
  );

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash protocol-relative URL", "/\\evil.example"],
    ["a relative path", "wiki"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a missing value", null],
  ])("falls back to / for %s", (_label, target) => {
    expect(safeRedirect(target)).toBe("/");
  });
});
