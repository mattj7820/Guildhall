import type { Role, Viewer } from "~/campaign/types";
import type { FolderNode, NoteSummary } from "~/wiki/types";
import { canView } from "~/campaign/visibility";
import { applyComments } from "./comments";
import { createLinkResolver, type LinkResolver } from "./link-resolver";
import { parseNote, type Note } from "./parse-note";
import { dirname, isMarkdown } from "./paths";
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

interface RenderedBody {
  html: string;
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

  /** Renders a note's body to HTML for the viewer. Results are cached per note and role. */
  render(note: Note, viewer: Viewer): string {
    return this.renderCollecting(note, viewer.role).html;
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
          markdown: viewer.role === "dm" ? note.body : applyComments(note.body, "player"),
        })),
      );
      this.searchIndexes.set(viewer.role, index);
    }
    return index.search(query);
  }

  /**
   * Every readable statblock in notes the viewer may see, in note order. Players' copies come from
   * the note with `%%comments%%` removed, so a statblock hidden in a comment stays secret.
   */
  statblocks(viewer: Viewer): NoteStatblock[] {
    let list = this.statblockLists.get(viewer.role);
    if (!list) {
      list = this.notes(viewer).flatMap((note) =>
        extractStatblocks(
          viewer.role === "dm" ? note.body : applyComments(note.body, "player"),
        ).map((statblock) => ({ note, statblock })),
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
    const rendered = { html, assets };
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
