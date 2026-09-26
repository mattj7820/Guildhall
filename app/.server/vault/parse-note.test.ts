import { describe, expect, it } from "vitest";
import { parseNote } from "./parse-note";

const withFrontmatter = (yaml: string, body = "Body text.") => `---\n${yaml}\n---\n${body}`;

describe("parseNote", () => {
  it("derives identity from the vault path", () => {
    const note = parseNote("NPCs/Mira Stonehand.md", "Body");
    expect(note).toMatchObject({
      id: "NPCs/Mira Stonehand",
      slug: "NPCs/Mira Stonehand",
      title: "Mira Stonehand",
      path: "NPCs/Mira Stonehand.md",
    });
  });

  it("uses a frontmatter id as the stable ID, leaving the URL slug path-based", () => {
    const note = parseNote("Secrets/Plan.md", withFrontmatter("id: lore-plan"));
    expect(note.id).toBe("lore-plan");
    expect(note.slug).toBe("Secrets/Plan");
  });

  it("strips frontmatter from the body", () => {
    expect(parseNote("a.md", withFrontmatter("visibility: players", "Hello")).body).toBe("Hello");
  });

  describe("visibility", () => {
    it("reads visibility: players", () => {
      expect(parseNote("a.md", withFrontmatter("visibility: players")).visibility).toBe("players");
    });

    it("defaults to dm when there is no frontmatter", () => {
      expect(parseNote("a.md", "Just text").visibility).toBe("dm");
    });

    it("fails closed to dm when the frontmatter is invalid YAML", () => {
      const note = parseNote("a.md", withFrontmatter("visibility: players\ntags: [unclosed", "Hi"));
      expect(note.visibility).toBe("dm");
      expect(note.frontmatterError).toBeDefined();
      expect(note.body.trim()).toBe("Hi");
    });
  });

  describe("entity type", () => {
    it("reads and lower-cases the type", () => {
      expect(parseNote("a.md", withFrontmatter("type: NPC")).type).toBe("npc");
    });

    it("accepts types the app doesn't know yet", () => {
      expect(parseNote("a.md", withFrontmatter("type: deity")).type).toBe("deity");
    });

    it("is undefined when absent", () => {
      expect(parseNote("a.md", "text").type).toBeUndefined();
    });
  });

  describe("aliases and tags", () => {
    it.each([
      ["a YAML list", "aliases: [Mira, The Smith]", ["Mira", "The Smith"]],
      ["a block list", "aliases:\n  - Mira\n  - The Smith", ["Mira", "The Smith"]],
      ["a comma-separated string", "aliases: Mira, The Smith", ["Mira", "The Smith"]],
      ["the singular key", "alias: Mira", ["Mira"]],
      ["an empty value", "aliases:", []],
    ])("reads aliases from %s", (_label, yaml, expected) => {
      expect(parseNote("a.md", withFrontmatter(yaml)).aliases).toEqual(expected);
    });

    it("strips leading # from tags", () => {
      expect(parseNote("a.md", withFrontmatter('tags: ["#npc", town]')).tags).toEqual([
        "npc",
        "town",
      ]);
    });
  });

  it("notices when the body supplies its own title heading", () => {
    expect(parseNote("a.md", "# Title\n\nText").hasOwnTitle).toBe(true);
    expect(parseNote("a.md", "Text\n\n# Later heading").hasOwnTitle).toBe(false);
  });
});
