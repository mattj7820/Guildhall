import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { renderMarkdown } from "../render";
import { parseStatblock } from "./parse-statblock";
import { renderStatblock } from "./rehype-statblocks";

const render = (markdown: string) =>
  renderMarkdown(markdown, { role: "dm", resolve: () => undefined, canSee: () => true });

const statblock = (...lines: string[]) => ["```statblock", ...lines, "```"].join("\n");

function statblockFrom(...lines: string[]) {
  const result = parseStatblock(lines.join("\n"));
  if (!result.ok) throw new Error(result.error);
  return result.statblock;
}

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

describe("rollable statblocks (combat tracker)", () => {
  const parsed = parseStatblock(
    [
      "name: Test Creature",
      "stats: [12, 15, 11, 1, 5, 1]",
      "saves:",
      "  - dexterity: 4",
      "skillsaves:",
      "  - stealth: 6",
      "actions:",
      "  - name: Test Slam",
      '    desc: "Melee Weapon Attack: +3 to hit. Hit: 5 (1d8 + 1) damage plus 3 (1d6) fire."',
      "  - name: Test Breath (Recharge 5–6)",
      "    desc: Fixture breath text.",
    ].join("\n"),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  const rollable = toHtml(renderStatblock(parsed.statblock, { rollable: true }));

  const button = (text: string, roll: string, kind: string, label: string, extra = "") =>
    `<button class="statblock-roll" type="button" data-roll="${roll}" data-roll-kind="${kind}" data-roll-label="${label}"${extra}>${text}</button>`;

  it("makes attack bonuses and damage dice clickable, labelled with the action", () => {
    expect(rollable).toContain(
      button(
        "+3",
        "1d20 + 3",
        "attack",
        "Test Slam attack",
        ' aria-label="Roll Test Slam attack: 1d20 + 3"',
      ),
    );
    expect(rollable).toContain('data-roll="1d8 + 1" data-roll-kind="damage"');
    expect(rollable).toContain('data-roll="1d6" data-roll-kind="damage"');
    expect(rollable).toContain("<em>Hit:</em> 5 (");
  });

  it("makes ability scores, saving throws and skills clickable", () => {
    expect(rollable).toContain(
      'data-roll="1d20 + 2" data-roll-kind="check" data-roll-label="DEX check"',
    );
    expect(rollable).toContain(
      'data-roll-label="Dex save" aria-label="Roll Dex save: 1d20 + 4">Dex +4<',
    );
    expect(rollable).toContain(
      'data-roll-label="Stealth check" aria-label="Roll Stealth check: 1d20 + 6">Stealth +6<',
    );
  });

  it("makes a recharge clickable, labelled without the recharge note", () => {
    expect(rollable).toContain(
      button(
        "Recharge 5–6",
        "1d6",
        "recharge",
        "Test Breath recharge",
        ' data-recharge-on="5" aria-label="Roll Test Breath recharge: 1d6, recharging on 5 or more"',
      ),
    );
  });

  it("keeps vault text out of the markup, even in roll labels", () => {
    const hostile = parseStatblock(
      [
        "name: X",
        "actions:",
        `  - name: '<img src=x onerror=alert(1)> x" onmouseover="alert(1)'`,
        '    desc: "Hit: 2 (1d4)."',
      ].join("\n"),
    );
    if (!hostile.ok) throw new Error(hostile.error);
    const tree = renderStatblock(hostile.statblock, { rollable: true });

    const tags: string[] = [];
    visit(tree, "element", (node) => void tags.push(node.tagName));
    expect(tags).not.toContain("img");
    // Quotes in the label are escaped, so it can't break out of its attribute.
    const html = toHtml(tree);
    expect(html).toContain('x&#x22; onmouseover=&#x22;alert(1) damage"');
  });

  describe("2024 statblocks", () => {
    const html = toHtml(
      renderStatblock(
        statblockFrom(
          "name: Fixture 2024 Creature",
          "ac: 15",
          "initiative: 4",
          "stats: [10, 14, 10, 10, 10, 10]",
          "gear: Fixture Spear",
          "actions:",
          "  - name: Fixture Jab",
          '    desc: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage."',
          "  - name: Fixture Burst",
          '    desc: "Dexterity Saving Throw: DC 12, each creature. Failure: 7 (2d6) Fire damage. Success: Half damage."',
          "reactions:",
          "  - name: Fixture Parry",
          '    desc: "Trigger: A creature hits it. Response: It adds 2 to its AC."',
        ),
        { rollable: true },
      ),
    );

    it("shows initiative after Armor Class, with the bonus to roll", () => {
      expect(html).toContain(
        '<strong>Initiative</strong> <button class="statblock-roll" type="button" data-roll="1d20 + 4" data-roll-kind="check" data-roll-label="Initiative" aria-label="Roll Initiative: 1d20 + 4">+4</button> (14)',
      );
      expect(html.indexOf("Armor Class")).toBeLessThan(html.indexOf("Initiative"));
    });

    it("shows gear", () => {
      expect(html).toContain("<strong>Gear</strong> Fixture Spear");
    });

    it("makes a 2024 attack roll clickable", () => {
      expect(html).toContain('data-roll="1d20 + 4" data-roll-kind="attack"');
    });

    it("italicises the 2024 labels", () => {
      for (const label of [
        "Melee Attack Roll:",
        "Hit:",
        "Dexterity Saving Throw:",
        "Failure:",
        "Success:",
        "Trigger:",
        "Response:",
      ]) {
        expect(html).toContain(`<em>${label}</em>`);
      }
    });
  });

  it("leaves wiki statblocks without roll buttons", () => {
    expect(toHtml(renderStatblock(parsed.statblock))).not.toContain("statblock-roll");
    const inNote = render(
      statblock(
        "name: X",
        "actions:",
        "  - name: Y",
        '    desc: "Melee Weapon Attack: +3 to hit."',
      ),
    );
    expect(inNote).toContain("+3 to hit");
    expect(inNote).not.toContain("statblock-roll");
  });
});
