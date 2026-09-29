import { describe, expect, it } from "vitest";
import type { Role } from "~/campaign/types";
import { parseNote, type Note } from "./parse-note";
import type { ResolvedTarget } from "./remark-wikilinks";
import { renderMarkdown } from "./render";

/** A tiny stand-in vault: link targets are looked up by exact name. */
const notes: Record<string, Note> = {
  Mira: parseNote("NPCs/Mira.md", "---\nvisibility: players\n---\n"),
  "Villain Plan": parseNote("Secrets/Villain Plan.md", "DM only"),
};
const assets: Record<string, string> = {
  "map.png": "Attachments/map.png",
  "handout.pdf": "Attachments/handout.pdf",
  "voice.m4a": "Voices/voice.m4a",
};

function render(markdown: string, role: Role = "dm") {
  const seenAssets: string[] = [];
  const html = renderMarkdown(markdown, {
    role,
    resolve: (target): ResolvedTarget | undefined =>
      notes[target]
        ? { kind: "note", note: notes[target] }
        : assets[target]
          ? { kind: "asset", path: assets[target] }
          : undefined,
    canSee: (note) => role === "dm" || note.visibility === "players",
    onAsset: (path) => seenAssets.push(path),
  });
  return { html, seenAssets };
}

describe("renderMarkdown", () => {
  describe("wikilinks", () => {
    it("renders a link to the note page", () => {
      expect(render("[[Mira]]").html).toContain(
        '<a href="/wiki/NPCs/Mira" class="wikilink">Mira</a>',
      );
    });

    it("uses the alias as link text", () => {
      expect(render("[[Mira|the smith]]").html).toContain(">the smith</a>");
    });

    it("links to a heading anchor using the same slug as the rendered heading", () => {
      const { html } = render("[[Mira#Early Life & Family]]");
      expect(html).toContain('href="/wiki/NPCs/Mira#early-life--family"');
      expect(html).toContain(">Mira > Early Life &#x26; Family</a>");
    });

    it("links to a heading in the same note", () => {
      const { html } = render("[[#Market Day]]\n\n## Market Day");
      expect(html).toContain('<a href="#market-day" class="wikilink">Market Day</a>');
      expect(html).toContain('<h2 id="market-day">Market Day</h2>');
    });

    it("URL-encodes spaces in paths", () => {
      expect(render("[[Villain Plan]]").html).toContain('href="/wiki/Secrets/Villain%20Plan"');
    });

    it("marks unresolved links as missing instead of linking nowhere", () => {
      const { html } = render("[[Nobody]]");
      expect(html).toContain('<span class="wikilink-missing">Nobody</span>');
      expect(html).not.toContain("<a");
    });

    it("leaves links in code untouched", () => {
      const { html } = render("`[[Mira]]`\n\n```\n[[Mira]]\n```");
      expect(html).not.toContain("<a");
      expect(html.match(/\[\[Mira\]\]/g)).toHaveLength(2);
    });

    it("renders a note embed as a link, since transclusion isn't supported yet", () => {
      expect(render("![[Mira]]").html).toContain('class="wikilink wikilink-embed"');
    });

    it("links to non-image attachments", () => {
      expect(render("![[handout.pdf]]").html).toContain(
        '<a href="/vault-asset/Attachments/handout.pdf" class="wikilink">handout.pdf</a>',
      );
    });
  });

  describe("image embeds", () => {
    it("renders an image served from the vault", () => {
      const { html, seenAssets } = render("![[map.png]]");
      expect(html).toContain('<img src="/vault-asset/Attachments/map.png" alt="map.png">');
      expect(seenAssets).toEqual(["Attachments/map.png"]);
    });

    it("applies a width", () => {
      expect(render("![[map.png|300]]").html).toContain('width="300"');
    });

    it("applies width and height", () => {
      expect(render("![[map.png|300x200]]").html).toMatch(/width="300" height="200"/);
    });

    it("uses non-numeric text as alt text", () => {
      expect(render("![[map.png|The valley]]").html).toContain('alt="The valley"');
    });
  });

  describe("audio embeds", () => {
    it("renders an inline player labelled with the file name", () => {
      const { html, seenAssets } = render("Voice: ![[voice.m4a]]");
      expect(html).toContain(
        '<p>Voice: <audio src="/vault-asset/Voices/voice.m4a" controls preload="metadata" aria-label="voice.m4a">',
      );
      expect(seenAssets).toEqual(["Voices/voice.m4a"]);
    });

    it("includes a download link as a fallback", () => {
      expect(render("![[voice.m4a]]").html).toContain(
        '<a href="/vault-asset/Voices/voice.m4a" class="wikilink">voice.m4a</a></audio>',
      );
    });

    it("links to audio instead of embedding it when written without !", () => {
      const { html } = render("[[voice.m4a]]");
      expect(html).not.toContain("<audio");
      expect(html).toContain('href="/vault-asset/Voices/voice.m4a"');
    });
  });

  describe("player view", () => {
    it("renders links to DM-only notes as plain text", () => {
      const { html } = render("Beware [[Villain Plan|the plan]].", "player");
      expect(html).toContain("Beware the plan.");
      expect(html).not.toContain("<a");
    });

    it("still links to player-visible notes", () => {
      expect(render("[[Mira]]", "player").html).toContain('class="wikilink"');
    });

    it("removes DM comments", () => {
      const { html } = render("Open. %%Trapped!%%", "player");
      expect(html).not.toContain("Trapped");
    });

    it("does not collect attachments embedded only inside DM comments", () => {
      expect(render("%%![[map.png]]%%", "player").seenAssets).toEqual([]);
    });
  });

  describe("DM view", () => {
    it("shows DM comments highlighted", () => {
      expect(render("Open. %%Trapped!%%").html).toContain(
        '<span class="dm-comment">Trapped!</span>',
      );
    });
  });

  describe("markdown and HTML", () => {
    it("supports GitHub-flavoured markdown", () => {
      const { html } = render("| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done");
      expect(html).toContain("<table>");
      expect(html).toContain('type="checkbox"');
    });

    it("keeps harmless raw HTML", () => {
      expect(render("Line<br>break <kbd>Ctrl</kbd>").html).toContain("<kbd>Ctrl</kbd>");
    });

    it.each([
      ["script tags", "<script>alert(1)</script>"],
      ["event handlers", '<img src="x" onerror="alert(1)">'],
      ["javascript: links", '<a href="javascript:alert(1)">x</a>'],
    ])("sanitises %s", (_label, source) => {
      const { html } = render(source);
      expect(html).not.toMatch(/<script|onerror|javascript:/);
    });

    it("drops class names the app didn't generate", () => {
      expect(render('<span class="dm-comment evil">x</span>').html).not.toContain("evil");
    });
  });
  describe("DM sections and DM callouts", () => {
    const note = [
      "Shared intro.",
      "",
      "> [!dm] Who they work for",
      "> The villain. ![[map.png]]",
      "",
      "## DM",
      "",
      "Section secret, see [[Mira]].",
      "",
      "> [!dm]",
      "> Callout inside the section.",
      "",
      "## Market",
      "",
      "Shared stalls.",
    ].join("\n");

    it("boxes each DM part for the DM, without the [!dm] marker", () => {
      const { html } = render(note, "dm");
      expect(html).toMatch(
        /<div class="dm-callout">\s*<p><strong>Who they work for<\/strong><br>\nThe villain\./,
      );
      expect(html).toMatch(/<div class="dm-section"><h2 id="dm">DM<\/h2>/);
      expect(html).not.toContain("[!dm]");
      // The callout inside the section is boxed too: anything unboxed is what players see.
      expect(html).toMatch(/<div class="dm-callout">\s*<p>Callout inside the section\.<\/p>/);
      expect(html).toContain('<h2 id="market">Market</h2>');
      expect(html).toContain('<a href="/wiki/NPCs/Mira" class="wikilink">Mira</a>');
    });

    it("keeps the Market section outside the DM box", () => {
      const { html } = render(note, "dm");
      const box = html.slice(html.indexOf('<div class="dm-section">'));
      expect(box.indexOf("</div>")).toBeLessThan(box.indexOf('id="market"'));
    });

    it("gives players the shared parts only, and none of the DM parts' images", () => {
      const { html, seenAssets } = render(note, "player");
      expect(html).toContain("Shared intro.");
      expect(html).toContain("Shared stalls.");
      expect(html).not.toMatch(/villain|secret|Callout|dm-/i);
      expect(seenAssets).toEqual([]);
    });

    it.each([
      ["a title on its own", "> [!dm] Only a title", "<p><strong>Only a title</strong></p>"],
      ["a folded one without a title", "> [!dm]-\n> Body", "<p>Body</p>"],
      ["a title with a link in it", "> [!dm] About [[Mira]]\n> Body", "About <a"],
    ])("shows the DM %s cleanly", (_name, markdown, expected) => {
      const { html } = render(markdown, "dm");
      expect(html).toContain(expected);
      expect(html).not.toContain("[!dm");
    });

    it("doesn't box other callouts", () => {
      expect(render("> [!note] Shared\n> text", "dm").html).not.toContain("dm-");
    });
  });
});
