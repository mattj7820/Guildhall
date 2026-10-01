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
    expect(snapshot.assets).toEqual([
      "Attachments/Fixture Duplicate.png",
      "Attachments/dm-map.png",
      "Attachments/mira-portrait.png",
      "Attachments/voice-sample.wav",
      "Maps/Fixture Duplicate.png",
      "Maps/Fixture Fog.png",
      "Maps/Fixture Keep.png",
      "Maps/Fixture Town.png",
      "Maps/Fixture World.png",
    ]);
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
      expect(folderNames(tree)).toEqual([
        "Bestiary",
        "Items",
        "Locations",
        "Maps",
        "NPCs",
        "Party",
        "Secrets",
        "Sessions",
      ]);
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

  describe("statblocks", () => {
    const names = (viewer = DM_VIEWER) =>
      vault.statblocks(viewer).map(({ statblock }) => statblock.name);

    it("lists every readable statblock with the note it's in", () => {
      expect(names()).toEqual(
        expect.arrayContaining([
          "Fixture Minion",
          "Fixture Companion",
          "Fixture Secret Form",
          "Fixture Bare",
          "Test Creature",
        ]),
      );
      const minion = vault.statblocks(DM_VIEWER).find((s) => s.statblock.name === "Fixture Minion");
      expect(minion?.note.slug).toBe("Bestiary/Fixture Minion");
      expect(minion?.statblock.numbers).toEqual({
        armorClass: 13,
        squares: 1,
        hitPoints: 7,
        hitDice: "2d6",
        dexterityModifier: 2,
      });
    });

    it("skips the unreadable statblock in a note that also has a readable one", () => {
      expect(names().filter((name) => name === "Test Creature")).toHaveLength(1);
    });

    it("gives players only statblocks from notes they can see, outside DM comments", () => {
      expect(names(PLAYER_VIEWER)).toContain("Fixture Companion");
      expect(names(PLAYER_VIEWER)).not.toContain("Fixture Minion");
      expect(names(PLAYER_VIEWER)).not.toContain("Fixture Secret Form");
    });
  });

  describe("party", () => {
    it("lists notes with type: pc, with who controls them", () => {
      expect(vault.party(DM_VIEWER).map((note) => [note.title, note.player])).toEqual([
        ["Fixture PC One", "Player One"],
        ["Fixture PC Two", "Player Two"],
      ]);
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

  describe("firstImage", () => {
    it("finds the first image a note embeds, skipping audio", () => {
      const mira = vault.getNote("NPCs/Mira Stonehand", DM_VIEWER)!;
      expect(vault.firstImage(mira, DM_VIEWER)).toBe("Attachments/mira-portrait.png");
    });

    it("never finds an image inside a DM part for players", () => {
      const informant = vault.getNote("NPCs/Fixture Informant", DM_VIEWER)!;
      expect(vault.firstImage(informant, DM_VIEWER)).toBe("Attachments/dm-map.png");
      expect(vault.firstImage(informant, PLAYER_VIEWER)).toBeUndefined();
    });
  });

  describe("noteById", () => {
    it("finds a note by its frontmatter id, or by its path when it has none", () => {
      expect(vault.noteById("location-fixture-town", PLAYER_VIEWER)?.title).toBe("Fixture Town");
      expect(vault.noteById("Locations/Brindleford", PLAYER_VIEWER)?.title).toBe("Brindleford");
    });

    it("treats a hidden note as missing", () => {
      expect(vault.noteById("lore-villain-plan", DM_VIEWER)?.title).toBe("Villain Plan");
      expect(vault.noteById("lore-villain-plan", PLAYER_VIEWER)).toBeUndefined();
      expect(vault.noteById("no-such-note", DM_VIEWER)).toBeUndefined();
    });
  });

  describe("maps", () => {
    it("lists every raster image as a possible map, but no audio", () => {
      expect(vault.mapImages()).toEqual(
        expect.arrayContaining(["Maps/Fixture World.png", "Attachments/dm-map.png"]),
      );
      expect(vault.mapImages()).not.toContain("Attachments/voice-sample.wav");
    });

    it("finds a map's image where it was recorded", () => {
      expect(vault.findImage("Maps/Fixture World.png")).toEqual({
        path: "Maps/Fixture World.png",
        moved: false,
      });
    });

    it("finds an image that has moved to another folder by its unique file name", () => {
      expect(vault.findImage("Old Folder/fixture town.PNG")).toEqual({
        path: "Maps/Fixture Town.png",
        moved: true,
      });
    });

    it.each(["Old Folder/Fixture Duplicate.png", "Maps/Deleted.png", "Home.md"])(
      "doesn't guess when there's no single match: %s",
      (path) => {
        expect(vault.findImage(path)).toBeUndefined();
      },
    );
  });
  describe("DM parts of shared notes", () => {
    const informant = (viewer: typeof DM_VIEWER) =>
      vault.getNote("NPCs/Fixture Informant", viewer)!;
    const found = (query: string, viewer: typeof DM_VIEWER) =>
      vault.search(query, viewer).some((result) => result.note.slug === "NPCs/Fixture Informant");

    it("shows players the shared part, and none of the DM section or DM callout", () => {
      const html = vault.render(informant(PLAYER_VIEWER), PLAYER_VIEWER);
      expect(html).toContain("persimmon");
      expect(html).toContain("damson");
      for (const secret of ["medlar", "loquat", "quince", "[!dm]", "dm-map.png"]) {
        expect(html).not.toContain(secret);
      }
    });

    it("keeps DM parts out of players' search", () => {
      expect(found("persimmon", PLAYER_VIEWER)).toBe(true);
      for (const secret of ["medlar", "loquat", "quince"]) {
        expect(found(secret, PLAYER_VIEWER)).toBe(false);
        expect(found(secret, DM_VIEWER)).toBe(true);
      }
    });

    it("keeps a statblock in a DM section from players", () => {
      const names = (viewer: typeof DM_VIEWER) =>
        vault.statblocks(viewer).map(({ statblock }) => statblock.name);
      expect(names(DM_VIEWER)).toContain("Fixture Informant Disguise");
      expect(names(PLAYER_VIEWER)).not.toContain("Fixture Informant Disguise");
    });

    it("doesn't let players load an image embedded only in a DM section", () => {
      expect(vault.getAsset("Attachments/dm-map.png", PLAYER_VIEWER)).toBeUndefined();
    });

    it("gives the DM everything", () => {
      const html = vault.render(informant(DM_VIEWER), DM_VIEWER);
      for (const word of ["persimmon", "medlar", "loquat", "quince", "damson"]) {
        expect(html).toContain(word);
      }
      expect(html).toContain('src="/vault-asset/Attachments/dm-map.png"');
    });

    it("decides whether a note opens with its own title from what the viewer sees", () => {
      // Players' page opens with "# Fixture Informant", once the "# DM" section is gone.
      expect(vault.hasOwnTitle(informant(PLAYER_VIEWER), PLAYER_VIEWER)).toBe(true);
      expect(vault.hasOwnTitle(vault.getNote("Home", DM_VIEWER)!, DM_VIEWER)).toBe(true);
      const untitled = vault.getNote("Secrets/Broken Frontmatter", DM_VIEWER)!;
      expect(vault.hasOwnTitle(untitled, DM_VIEWER)).toBe(false);
    });
  });
});
