import { describe, expect, it } from "vitest";
import { forPlayers } from "./dm-parts";

const md = (...lines: string[]) => lines.join("\n");

/** What players get: every `keep` word survives, and no `SECRET` word does. */
function expectPlayers(markdown: string, keep: string[]) {
  const text = forPlayers(markdown);
  for (const word of keep) expect(text).toContain(word);
  expect(text).not.toMatch(/SECRET/);
  return text;
}

describe("forPlayers: DM sections", () => {
  it("hides a DM section up to the next heading of the same level", () => {
    expectPlayers(md("Shared intro", "", "## DM", "SECRET plot", "", "## Market", "Stalls"), [
      "Shared intro",
      "## Market",
      "Stalls",
    ]);
  });

  it("hides deeper headings inside the section, and stops at a higher one", () => {
    expectPlayers(
      md("## DM", "SECRET a", "### Villain", "SECRET b", "#### Lair", "SECRET c", "# Next part"),
      ["# Next part"],
    );
  });

  it("hides to the end of the note when nothing follows", () => {
    const text = expectPlayers(md("Shared", "", "## DM", "SECRET one", "", "- SECRET two"), [
      "Shared",
    ]);
    expect(text.trim()).toBe("Shared");
  });

  it.each([
    ["any level", md("# DM", "SECRET")],
    ["any case", md("## dm", "SECRET")],
    ["bold", md("## **DM**", "SECRET")],
    ["with a trailing HTML comment", md("## DM <!-- for me -->", "SECRET")],
    ["setext style", md("DM", "--", "SECRET")],
    ["closing hashes", md("## DM ##", "SECRET")],
  ])("recognises a DM heading written %s", (_name, markdown) => {
    // A top-level heading after it, which ends a DM section of any level.
    expectPlayers(md("Shared", "", markdown, "", "# After", "Kept"), ["Shared", "Kept"]);
  });

  it.each([
    ["DM notes", "## DM notes"],
    ["DM:", "## DM:"],
    ["a wikilink", "## [[DM]]"],
  ])("only counts a heading that is exactly DM, not %s", (_name, heading) => {
    const text = forPlayers(md(heading, "Visible"));
    expect(text).toContain("Visible");
  });

  it("leaves a DM heading inside a code block alone", () => {
    const source = md("```", "## DM", "not a secret", "```");
    expect(forPlayers(source)).toBe(source);
  });

  it("hides a DM heading inside a list item, to the end of that item", () => {
    expectPlayers(md("- Shop", "  ## DM", "  SECRET owner", "- Tavern"), ["Shop", "Tavern"]);
  });
});

describe("forPlayers: DM callouts", () => {
  it.each([
    ["with a title", md("> [!dm] The truth", "> SECRET")],
    ["without a title", md("> [!dm]", "> SECRET")],
    ["folded", md("> [!dm]- Spoiler", "> SECRET")],
    ["expanded", md("> [!DM]+ Spoiler", "> SECRET")],
    ["in a lazy continuation line", md("> [!dm] Title", "SECRET continues without a marker")],
  ])("hides a DM callout %s", (_name, callout) => {
    expectPlayers(md("Before", "", callout, "", "After"), ["Before", "After"]);
  });

  it("leaves other callouts and plain quotes alone", () => {
    const text = forPlayers(md("> [!note] Shared", "> Everyone sees this", "", "> A quote"));
    expect(text).toContain("Everyone sees this");
    expect(text).toContain("A quote");
  });

  it("hides a DM callout inside another callout, keeping the rest of it", () => {
    expectPlayers(md("> [!note] Rumours", "> Shared rumour", "> > [!dm]", "> > SECRET truth"), [
      "Shared rumour",
    ]);
  });

  it("hides a DM heading inside a callout, and a callout inside a DM section", () => {
    expectPlayers(md("> [!note]", "> Shared", "> ## DM", "> SECRET"), ["Shared"]);
    expectPlayers(md("## DM", "> [!dm]", "> SECRET", "SECRET too", "## After"), ["## After"]);
  });

  it("ends a callout at a blank line, as Obsidian does, so a quote after it is shared", () => {
    const text = forPlayers(md("> [!dm]", "> SECRET", "", "> Shared quote"));
    expect(text).not.toContain("SECRET");
    expect(text).toContain("Shared quote");
  });
});

describe("forPlayers: with comments and other markdown", () => {
  it("removes comments as before, and handles Windows line endings", () => {
    const text = expectPlayers(
      ["Shared %%SECRET aside%%", "", "## DM", "SECRET", "", "## After", "Kept"].join("\r\n"),
      ["Shared", "## After", "Kept"],
    );
    expect(text).not.toContain("\r");
  });

  it("hides a comment that spans into a DM section", () => {
    expectPlayers(md("Shared", "%%SECRET", "## DM", "SECRET%%", "Kept", "## DM", "SECRET"), [
      "Shared",
      "Kept",
    ]);
  });

  it("leaves no footnote or link target from a DM section behind", () => {
    const text = expectPlayers(
      md(
        "Shared[^1] and [a link][hidden].",
        "",
        "## DM",
        "[^1]: SECRET footnote",
        "[hidden]: https://example.com/SECRET",
      ),
      ["Shared"],
    );
    expect(text).not.toContain("example.com");
  });

  it("leaves a note with no DM parts unchanged apart from comments", () => {
    const note = md("# Title", "", "Text with [[Links]] and ![[Image.png]]", "", "## Market");
    expect(forPlayers(note)).toBe(note);
  });
});
