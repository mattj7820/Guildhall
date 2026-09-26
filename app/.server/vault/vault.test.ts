import { beforeAll, describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { readVault } from "./read-vault";
import type { FolderNode } from "~/wiki/types";
import { Vault } from "./vault";

/** Integration tests over the fixture vault in tests/fixtures/vault. */
let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

const slugs = (notes: { slug: string }[]) => notes.map((note) => note.slug);

describe("readVault", () => {
  it("reads notes and attachments with POSIX vault paths", async () => {
    const snapshot = await readVault(FIXTURE_VAULT);
    expect(snapshot.notes.map((note) => note.path)).toContain("NPCs/Mira Stonehand.md");
    expect(snapshot.assets).toEqual(["Attachments/dm-map.png", "Attachments/mira-portrait.png"]);
  });

  it("skips Obsidian's config folder and trash", async () => {
    const snapshot = await readVault(FIXTURE_VAULT);
    const paths = [...snapshot.notes.map((note) => note.path), ...snapshot.assets];
    expect(paths.filter((p) => p.includes(".obsidian") || p.includes(".trash"))).toEqual([]);
  });
});

describe("Vault", () => {
  describe("visibility", () => {
    it("shows the DM every note", () => {
      expect(slugs(vault.notes(DM_VIEWER))).toEqual(
        expect.arrayContaining(["Secrets/Villain Plan", "NPCs/Captain Voss", "Home"]),
      );
    });

    it("hides DM-only, unmarked and malformed notes from players", () => {
      const visible = slugs(vault.notes(PLAYER_VIEWER));
      expect(visible).toContain("Home");
      expect(visible).not.toContain("Secrets/Villain Plan");
      expect(visible).not.toContain("NPCs/Captain Voss");
      expect(visible).not.toContain("Secrets/Broken Frontmatter");
    });

    it("treats a hidden note as missing when looked up by slug", () => {
      expect(vault.getNote("Secrets/Villain Plan", DM_VIEWER)).toBeDefined();
      expect(vault.getNote("Secrets/Villain Plan", PLAYER_VIEWER)).toBeUndefined();
    });

    it("looks notes up case-insensitively", () => {
      expect(vault.getNote("npcs/mira stonehand", PLAYER_VIEWER)?.title).toBe("Mira Stonehand");
    });
  });

  describe("rendering fixture notes", () => {
    const html = (slug: string, viewer = DM_VIEWER) =>
      vault.render(vault.getNote(slug, viewer)!, viewer);

    it("resolves every link form used on the Home note", () => {
      const home = html("Home");
      expect(home).toContain('href="/wiki/Locations/Brindleford"');
      expect(home).toContain(">the blacksmith</a>");
      expect(home).toContain('href="/wiki/Sessions/Session%201#loot"');
      expect(home).toContain('href="/wiki/Locations/Old%20Mill"');
      expect(home).toContain('href="/wiki/NPCs/Captain%20Voss"');
      expect(home).toContain('class="wikilink-missing"');
    });

    it("resolves an ambiguous name to the note in the linking note's folder", () => {
      expect(html("Locations/Brindleford")).toContain('href="/wiki/Locations/Old%20Mill"');
    });

    it("unlinks DM-only notes for players", () => {
      const forPlayers = html("Locations/Brindleford", PLAYER_VIEWER);
      expect(forPlayers).toContain("Captain Voss");
      expect(forPlayers).not.toContain("/wiki/NPCs/Captain%20Voss");
    });
  });

  describe("folderTree", () => {
    const folderNames = (node: FolderNode) => node.folders.map((folder) => folder.name);

    it("lists folders and root notes in natural order", () => {
      const tree = vault.folderTree(DM_VIEWER);
      expect(folderNames(tree)).toEqual(["Locations", "NPCs", "Secrets", "Sessions"]);
      expect(tree.notes.map((note) => note.title)).toEqual(["Home", "README"]);
    });

    it("nests subfolders", () => {
      const locations = vault.folderTree(DM_VIEWER).folders.find((f) => f.name === "Locations")!;
      expect(folderNames(locations)).toEqual(["Brindleford"]);
      expect(locations.folders[0].path).toBe("Locations/Brindleford");
    });

    it("omits folders with nothing the viewer can see", () => {
      expect(folderNames(vault.folderTree(PLAYER_VIEWER))).not.toContain("Secrets");
    });
  });

  describe("search", () => {
    it("finds notes by body text", () => {
      expect(slugs(vault.search("quartermaster", DM_VIEWER).map((r) => r.note))).toEqual(
        expect.arrayContaining(["NPCs/Captain Voss", "Secrets/Villain Plan"]),
      );
    });

    it("never returns hidden notes to players", () => {
      expect(vault.search("quartermaster", PLAYER_VIEWER)).toEqual([]);
    });

    it("finds notes by alias", () => {
      expect(vault.search("Start Here", PLAYER_VIEWER)[0]?.note.slug).toBe("Home");
    });

    it("matches word prefixes", () => {
      expect(slugs(vault.search("stoneh", PLAYER_VIEWER).map((r) => r.note))).toContain(
        "NPCs/Mira Stonehand",
      );
    });

    it("does not match text inside DM comments for players", () => {
      expect(vault.search("forge", DM_VIEWER).length).toBeGreaterThan(0);
      expect(vault.search("forge", PLAYER_VIEWER)).toEqual([]);
    });

    it("returns a snippet around the match", () => {
      expect(vault.search("brass", PLAYER_VIEWER)[0]?.snippet).toContain("brass key");
    });

    it("returns nothing for an empty query", () => {
      expect(vault.search("  ", DM_VIEWER)).toEqual([]);
    });
  });

  describe("getAsset", () => {
    it("serves any attachment to the DM", () => {
      expect(vault.getAsset("Attachments/dm-map.png", DM_VIEWER)).toBe("Attachments/dm-map.png");
    });

    it("serves players only attachments embedded in notes they can see", () => {
      expect(vault.getAsset("Attachments/mira-portrait.png", PLAYER_VIEWER)).toBeDefined();
      expect(vault.getAsset("Attachments/dm-map.png", PLAYER_VIEWER)).toBeUndefined();
    });

    it.each(["../package.json", "Home.md", ".obsidian/app.json", "Attachments/missing.png"])(
      "refuses anything that is not a known attachment: %s",
      (path) => {
        expect(vault.getAsset(path, DM_VIEWER)).toBeUndefined();
      },
    );
  });
});
