import matter from "gray-matter";
import { parseVisibility } from "~/campaign/visibility";
import type { EntityId, Visibility } from "~/campaign/types";
import { basename, stripMarkdownExtension } from "./paths";

/** A markdown note from the vault, parsed but not yet rendered. */
export interface Note {
  /** Stable entity ID: frontmatter `id`, or the slug. */
  id: EntityId;
  /** Vault-relative POSIX path including extension, e.g. `NPCs/Mira Stonehand.md`. */
  path: string;
  /** Path without extension; used in URLs. */
  slug: string;
  /** Display title: the file name, as in Obsidian. */
  title: string;
  visibility: Visibility;
  /** Entity type from frontmatter (lower-cased), e.g. `npc`. */
  type?: string;
  aliases: string[];
  tags: string[];
  /** For `type: pc` notes: the name of the player who controls the character. */
  player?: string;
  /** Markdown body with frontmatter removed. */
  body: string;
  /** Set when the frontmatter could not be parsed; the note is then treated as DM-only. */
  frontmatterError?: string;
}

export function parseNote(path: string, source: string): Note {
  const slug = stripMarkdownExtension(path);
  const title = stripMarkdownExtension(basename(path));

  let data: Record<string, unknown> = {};
  let body: string;
  let frontmatterError: string | undefined;
  try {
    // Pass an options object so gray-matter doesn't serve (and share) results from its cache.
    const parsed = matter(source, {});
    data = parsed.data;
    body = parsed.content;
  } catch (error) {
    frontmatterError = error instanceof Error ? error.message : String(error);
    body = stripFrontmatterBlock(source);
  }

  return {
    id: nonEmptyString(data.id) ?? slug,
    path,
    slug,
    title,
    visibility: parseVisibility(data.visibility),
    type: nonEmptyString(data.type)?.toLowerCase(),
    aliases: stringList(data.aliases ?? data.alias),
    tags: stringList(data.tags ?? data.tag).map((tag) => tag.replace(/^#/, "")),
    player: nonEmptyString(data.player),
    body,
    frontmatterError,
  };
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Obsidian accepts both YAML lists and single/comma-separated strings for aliases and tags. */
function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(nonEmptyString).filter((item): item is string => item !== undefined);
  }
  const single = nonEmptyString(value);
  return single
    ? single
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

/** Removes a leading `---` … `---` block without interpreting it. */
function stripFrontmatterBlock(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(source);
  return match ? source.slice(match[0].length) : source;
}
