import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../render";

const render = (markdown: string) =>
  renderMarkdown(markdown, { role: "dm", resolve: () => undefined, canSee: () => true });

const statblock = (...lines: string[]) => ["```statblock", ...lines, "```"].join("\n");

describe("statblocks in rendered notes", () => {
  const html = render(
    statblock(
      "name: Test Creature",
      "size: Small",
      "type: construct",
      "ac: 17",
      "stats: [12, 15, 11, 1, 5, 1]",
      "cr: 1/4",
      "traits:",
      "  - name: Test Trait",
      "    desc: Fixture trait text.",
      "actions:",
      "  - name: Test Slam",
      '    desc: "Melee Weapon Attack: +3 to hit. Hit: 5 (1d8 + 1) damage."',
    ),
  );

  it("replaces the code block with a labelled statblock", () => {
    expect(html).toContain(
      '<section class="statblock not-prose" aria-label="Statblock: Test Creature">',
    );
    expect(html).not.toContain("<pre>");
  });

  it("shows the name and description", () => {
    expect(html).toContain('<h3 class="statblock-name">Test Creature</h3>');
    expect(html).toContain('<p class="statblock-description">Small construct</p>');
  });

  it("labels properties", () => {
    expect(html).toContain('<p class="statblock-property"><strong>Armor Class</strong> 17</p>');
    expect(html).toContain("<strong>Challenge</strong> 1/4 (50 XP)");
  });

  it("lays out ability scores with modifiers", () => {
    expect(html).toContain('<th scope="col">DEX</th>');
    expect(html).toContain("<td>15 (+2)</td>");
  });

  it("formats traits and actions like the books", () => {
    expect(html).toContain("<strong><em>Test Trait.</em></strong> Fixture trait text.");
    expect(html).toContain('<h4 class="statblock-section">Actions</h4>');
    expect(html).toContain("<em>Melee Weapon Attack:</em> +3 to hit. <em>Hit:</em> 5 (1d8 + 1)");
  });

  it("omits sections with nothing in them", () => {
    expect(html).not.toContain("Reactions");
    expect(html).not.toContain("Senses");
  });

  it("inserts vault text as text, never as HTML", () => {
    const hostile = render(statblock('name: "<img src=x onerror=alert(1)>"', "ac: <b>12</b>"));
    // `<` may appear inside the quoted aria-label value, which is safe; no element may be created.
    const outsideAttributes = hostile.replace(/aria-label="[^"]*"/, "");
    expect(outsideAttributes).not.toMatch(/<img|<b>/);
    expect(hostile).toContain("&#x3C;img src=x onerror=alert(1)>");
  });

  it("shows an explanation plus the original block when the statblock can't be read", () => {
    const broken = render(statblock("ac: 12"));
    expect(broken).toContain('<div class="statblock-error">');
    expect(broken).toContain("The statblock has no name.");
    expect(broken).toContain('<code class="language-statblock">ac: 12');
  });

  it("leaves other code blocks alone", () => {
    expect(render("```yaml\nname: X\n```")).toContain('<code class="language-yaml">');
  });
});
