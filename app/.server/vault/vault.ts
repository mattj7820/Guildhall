import type { EntityId, Role, Viewer } from "~/campaign/types";
import type { FolderNode, NoteSummary } from "~/wiki/types";
import { canView } from "~/campaign/visibility";
import { forPlayers } from "./dm-parts";
import { createLinkResolver, type LinkResolver } from "./link-resolver";
import { parseNote, type Note } from "./parse-note";
import { isMapImage, mediaKind } from "./media";
import { basename, dirname, isMarkdown } from "./paths";
import { readVault, type VaultSnapshot } from "./read-vault";
import { renderMarkdown } from "./render";
import type { ResolvedTarget } from "./remark-wikilinks";
import { SearchIndex, type SearchResult } from "./search";
import { extractStatblocks } from "./statblock/extract-statblocks";
import type { Statblock } from "./statblock/parse-statblock";

/** A statblock and the note it's written in. */
export interface NoteStatblock {
  note: Note;
  statblock: Statblock;
}

/** Where a map's image was found: at its recorded path, or moved elsewhere in the vault. */
export interface FoundImage {
  path: string;
  moved: boolean;
}

interface RenderedBody {
  html: string;
  /** The page starts with its own top-level heading, so the title needn't be shown again. */
  hasOwnTitle: boolean;
  /** Attachments the note links to or embeds. */
  assets: string[];
}

/**
 * An immutable, in-memory view of the vault at one moment. Every query takes a Viewer, so
 * visibility is decided in one place rather than in each route.
 */
export class Vault {
  private readonly notesByPath = new Map<string, Note>();
  private readonly notesBySlug = new Map<string, Note>();
  private readonly notesById = new Map<EntityId, Note>();
  private readonly assets: ReadonlySet<string>;
  private readonly resolver: LinkResolver;
  private readonly renderCache = new Map<string, RenderedBody>();
  private readonly searchIndexes = new Map<Role, SearchIndex>();
  private readonly statblockLists = new Map<Role, NoteStatblock[]>();
  private playerAssets?: ReadonlySet<string>;

  static async load(root: string): Promise<Vault> {
    return new Vault(await readVault(root));
  }

  constructor(snapshot: VaultSnapshot) {
    for (const { path, source } of snapshot.notes) {
      const note = parseNote(path, source);
      this.notesByPath.set(path, note);
      this.notesBySlug.set(note.slug.toLowerCase(), note);
      // Notes are read in path order, so if two share an `id` the first path wins, consistently.
      if (!this.notesById.has(note.id)) this.notesById.set(note.id, note);
    }
    this.assets = new Set(snapshot.assets);
    this.resolver = createLinkResolver([...this.notesByPath.keys(), ...snapshot.assets]);
  }

  /** All notes the viewer may see, sorted by path. */
  notes(viewer: Viewer): Note[] {
    return [...this.notesByPath.values()].filter((note) => canView(viewer, note.visibility));
  }

  /** Looks a note up by URL slug. Hidden notes are indistinguishable from missing ones. */
  getNote(slug: string, viewer: Viewer): Note | undefined {
    const note = this.notesBySlug.get(slug.toLowerCase());
    return note && canView(viewer, note.visibility) ? note : undefined;
  }

  /** Looks a note up by entity ID. Hidden notes are indistinguishable from missing ones. */
  noteById(id: EntityId, viewer: Viewer): Note | undefined {
    const note = this.notesById.get(id);
    return note && canView(viewer, note.visibility) ? note : undefined;
  }

  /** Renders a note's body to HTML for the viewer. Results are cached per note and role. */
  render(note: Note, viewer: Viewer): string {
    return this.renderCollecting(note, viewer.role).html;
  }

  /**
   * Whether the note, as this viewer sees it, opens with its own `# Title`. Decided on what the
   * viewer actually gets: a note that opens with a hidden `# DM` section has no title for players.
   */
  /**
   * The first image a note shows this viewer, for a character's portrait. For players, images in
   * DM parts and comments don't count, as they're never shown.
   */
  firstImage(note: Note, viewer: Viewer): string | undefined {
    return this.renderCollecting(note, viewer.role).assets.find(
      (asset) => mediaKind(asset) === "image",
    );
  }

  hasOwnTitle(note: Note, viewer: Viewer): boolean {
    return this.renderCollecting(note, viewer.role).hasOwnTitle;
  }

  folderTree(viewer: Viewer): FolderNode {
    const root: FolderNode = { name: "", path: "", folders: [], notes: [] };
    for (const note of this.notes(viewer)) {
      let folder = root;
      for (const segment of dirname(note.path).split("/").filter(Boolean)) {
        const path = folder.path ? `${folder.path}/${segment}` : segment;
        let child = folder.folders.find((f) => f.name === segment);
        if (!child) {
          child = { name: segment, path, folders: [], notes: [] };
          folder.folders.push(child);
        }
        folder = child;
      }
      folder.notes.push(summarise(note));
    }
    sortTree(root);
    return root;
  }

  search(query: string, viewer: Viewer): SearchResult[] {
    let index = this.searchIndexes.get(viewer.role);
    if (!index) {
      index = new SearchIndex(
        this.notes(viewer).map((note) => ({
          note,
          markdown: viewer.role === "dm" ? note.body : forPlayers(note.body),
        })),
      );
      this.searchIndexes.set(viewer.role, index);
    }
    return index.search(query);
  }

  /**
   * Every readable statblock in notes the viewer may see, in note order. Players' copies come from
   * the note as players see it, so a statblock in a comment or DM part stays secret.
   */
  statblocks(viewer: Viewer): NoteStatblock[] {
    let list = this.statblockLists.get(viewer.role);
    if (!list) {
      list = this.notes(viewer).flatMap((note) =>
        extractStatblocks(viewer.role === "dm" ? note.body : forPlayers(note.body)).map(
          (statblock) => ({ note, statblock }),
        ),
      );
      this.statblockLists.set(viewer.role, list);
    }
    return list;
  }

  /** Player characters: notes with `type: pc` that the viewer may see. */
  party(viewer: Viewer): Note[] {
    return this.notes(viewer).filter((note) => note.type === "pc");
  }

  /**
   * Returns the vault path of an attachment if the viewer may load it. The DM can load any
   * attachment; players only those linked or embedded from notes they can see. Only files found
   * when the vault was read are ever returned, so no other path can be served.
   */
  getAsset(vaultPath: string, viewer: Viewer): string | undefined {
    if (!this.assets.has(vaultPath)) return undefined;
    if (viewer.role === "dm") return vaultPath;
    return this.assetsVisibleToPlayers().has(vaultPath) ? vaultPath : undefined;
  }

  /** Every image that can be made into a map, by path. For the DM's map picker. */
  mapImages(): string[] {
    return [...this.assets].filter(isMapImage);
  }

  /**
   * Finds a map's image: at its recorded path, or, if that file has gone, the one image elsewhere
   * with the same file name (ignoring case). Undefined if there's none, or several to choose
   * from. This is not a visibility check: the caller decides whether the map may be seen.
   */
  findImage(vaultPath: string): FoundImage | undefined {
    if (this.assets.has(vaultPath) && isMapImage(vaultPath))
      return { path: vaultPath, moved: false };
    const name = basename(vaultPath).toLowerCase();
    const matches = this.mapImages().filter((path) => basename(path).toLowerCase() === name);
    return matches.length === 1 ? { path: matches[0], moved: true } : undefined;
  }

  private assetsVisibleToPlayers(): ReadonlySet<string> {
    if (!this.playerAssets) {
      const assets = new Set<string>();
      for (const note of this.notes({ role: "player" })) {
        this.renderCollecting(note, "player").assets.forEach((asset) => assets.add(asset));
      }
      this.playerAssets = assets;
    }
    return this.playerAssets;
  }

  private renderCollecting(note: Note, role: Role): RenderedBody {
    const key = `${role}:${note.path}`;
    const cached = this.renderCache.get(key);
    if (cached) return cached;

    const assets: string[] = [];
    const html = renderMarkdown(note.body, {
      role,
      resolve: (target) => this.resolveTarget(target, note.path),
      canSee: (linked) => canView({ role }, linked.visibility),
      onAsset: (path) => assets.push(path),
    });
    const rendered = { html, assets, hasOwnTitle: /^\s*<h1[\s>]/.test(html) };
    this.renderCache.set(key, rendered);
    return rendered;
  }

  private resolveTarget(target: string, fromPath: string): ResolvedTarget | undefined {
    const path = this.resolver.resolve(target, fromPath);
    if (!path) return undefined;
    if (isMarkdown(path)) {
      const note = this.notesByPath.get(path);
      return note ? { kind: "note", note } : undefined;
    }
    return this.assets.has(path) ? { kind: "asset", path } : undefined;
  }
}

function summarise(note: Note): NoteSummary {
  return { id: note.id, slug: note.slug, title: note.title, type: note.type };
}

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function sortTree(folder: FolderNode): void {
  folder.folders.sort((a, b) => byName.compare(a.name, b.name));
  folder.notes.sort((a, b) => byName.compare(a.title, b.title));
  folder.folders.forEach(sortTree);
}
