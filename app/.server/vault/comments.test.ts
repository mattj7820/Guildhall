import { describe, expect, it } from "vitest";
import { applyComments } from "./comments";

const md = (...lines: string[]) => lines.join("\n");

describe("applyComments in player view", () => {
  const forPlayers = (markdown: string) => applyComments(markdown, "player");

  it("removes an inline comment", () => {
    expect(forPlayers("The door is locked. %%The key is under the mat.%%")).toBe(
      "The door is locked. ",
    );
  });

  it("removes several comments on one line", () => {
    expect(forPlayers("a %%one%% b %%two%% c")).toBe("a  b  c");
  });

  it("removes a comment spanning several paragraphs", () => {
    const result = forPlayers(
      md("Before", "", "%%", "Secret one", "", "Secret two", "%%", "After"),
    );
    expect(result).not.toContain("Secret");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("hides the rest of the note after an unclosed comment", () => {
    const result = forPlayers(md("Visible", "%% never closed", "Still secret"));
    expect(result).toContain("Visible");
    expect(result).not.toContain("secret");
  });

  it("leaves %% inside inline code alone", () => {
    expect(forPlayers("Use `%%` to write a comment")).toBe("Use `%%` to write a comment");
  });

  it("leaves %% inside fenced code blocks alone", () => {
    const source = md("```", "%%not a comment%%", "```");
    expect(forPlayers(source)).toBe(source);
  });

  it("leaves text without comments untouched", () => {
    const source = md("# Title", "", "A 50% chance.");
    expect(forPlayers(source)).toBe(source);
  });
});

describe("applyComments in DM view", () => {
  const forDm = (markdown: string) => applyComments(markdown, "dm");

  it("marks an inline comment as a DM note", () => {
    expect(forDm("Locked. %%Key under mat.%%")).toBe(
      'Locked. <span class="dm-comment">Key under mat.</span>',
    );
  });

  it("renders a multi-line comment as a single-line block", () => {
    expect(forDm(md("%%", "Line one", "", "Line two", "%%"))).toBe(
      '<div class="dm-comment">Line one<br><br>Line two</div>',
    );
  });

  it("escapes HTML inside comments", () => {
    expect(forDm("%%<script>alert(1)</script>%%")).toBe(
      '<span class="dm-comment">&lt;script&gt;alert(1)&lt;/script&gt;</span>',
    );
  });

  it("keeps an unclosed comment visible to the DM", () => {
    expect(forDm(md("Visible", "%%", "Unclosed"))).toContain(
      '<div class="dm-comment">Unclosed</div>',
    );
  });
});
