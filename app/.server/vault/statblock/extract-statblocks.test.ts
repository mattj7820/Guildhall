import { describe, expect, it } from "vitest";
import { extractStatblocks } from "./extract-statblocks";

const fence = (lang: string, ...lines: string[]) => ["```" + lang, ...lines, "```"].join("\n");

describe("extractStatblocks", () => {
  it("finds every readable statblock in order", () => {
    const markdown = [
      "Intro text.",
      fence("statblock", "name: First"),
      "Between.",
      fence("statblock", "name: Second"),
    ].join("\n\n");
    expect(extractStatblocks(markdown).map((statblock) => statblock.name)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("skips statblocks that can't be read", () => {
    const markdown = [fence("statblock", "ac: 12"), fence("statblock", "name: Good")].join("\n\n");
    expect(extractStatblocks(markdown).map((statblock) => statblock.name)).toEqual(["Good"]);
  });

  it("ignores other code blocks, even ones that look like statblocks", () => {
    const markdown = [fence("yaml", "name: Not a statblock"), "    name: indented code"].join(
      "\n\n",
    );
    expect(extractStatblocks(markdown)).toEqual([]);
  });

  it("finds statblocks inside block quotes, as in Obsidian callouts", () => {
    const markdown = fence("statblock", "name: Quoted")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    expect(extractStatblocks(markdown).map((statblock) => statblock.name)).toEqual(["Quoted"]);
  });
});
