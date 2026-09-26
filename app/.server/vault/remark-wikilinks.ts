import { slug as slugify } from "github-slugger";
import type { Image, Link, PhrasingContent, Root, Text } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";
import { parseWikilink, type WikilinkParts } from "./link-resolver";
import type { Note } from "./parse-note";
import { assetUrl, noteUrl } from "~/wiki/urls";
import { mediaKind } from "./media";
import { basename } from "./paths";

/** What a wikilink target resolved to. */
export type ResolvedTarget = { kind: "note"; note: Note } | { kind: "asset"; path: string };

export interface WikilinkOptions {
  /** Resolve a link target (as written) to a note or attachment. */
  resolve(target: string): ResolvedTarget | undefined;
  /** Whether the current viewer may see a note. Hidden notes render as plain text, not links. */
  canSee(note: Note): boolean;
  /** Called for every attachment this note links to or embeds. */
  onAsset?(path: string): void;
  /** Called for every note this note links to (visible to the viewer). */
  onNoteLink?(note: Note): void;
}

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;

/**
 * remark plugin: turns Obsidian `[[wikilinks]]` and `![[embeds]]` in text into links, images and
 * audio players.
 * Only text nodes are touched, so links inside code spans and code blocks stay literal.
 */
export function remarkWikilinks(options: WikilinkOptions) {
  return (tree: Root) => {
    findAndReplace(tree, [
      [
        WIKILINK,
        (_match: string, bang: string, inner: string) => toNode(inner, bang === "!", options),
      ],
    ]);
  };
}

function toNode(inner: string, isEmbed: boolean, options: WikilinkOptions): PhrasingContent {
  const parts = parseWikilink(inner);

  // [[#Heading]] links within the current note.
  if (!parts.target) {
    const text = parts.alias ?? parts.heading ?? inner;
    return parts.heading ? wikilink(`#${slugify(parts.heading)}`, text) : plainText(text);
  }

  const resolved = options.resolve(parts.target);
  const text = displayText(parts);

  if (!resolved) return missing(text);

  if (resolved.kind === "asset") {
    options.onAsset?.(resolved.path);
    if (isEmbed && mediaKind(resolved.path) === "image") return image(resolved.path, parts);
    if (isEmbed && mediaKind(resolved.path) === "audio") return audio(resolved.path);
    return wikilink(assetUrl(resolved.path), parts.alias ?? basename(resolved.path));
  }

  const { note } = resolved;
  if (!options.canSee(note)) return plainText(text);
  options.onNoteLink?.(note);
  const heading = parts.heading ? slugify(parts.heading) : undefined;
  // Note embeds (transclusion) aren't supported yet; they render as a link to the note.
  return wikilink(noteUrl(note.slug, heading), text, isEmbed ? "wikilink-embed" : undefined);
}

/** Obsidian shows `Note > Heading` for heading links without an alias. */
function displayText(parts: WikilinkParts): string {
  if (parts.alias) return parts.alias;
  return parts.heading ? `${parts.target} > ${parts.heading}` : parts.target;
}

function wikilink(url: string, text: string, extraClass?: string): Link {
  return {
    type: "link",
    url,
    children: [plainText(text)],
    data: { hProperties: { className: ["wikilink", ...(extraClass ? [extraClass] : [])] } },
  };
}

function plainText(value: string): Text {
  return { type: "text", value };
}

/** Rendered as `<span class="wikilink-missing">`: shows the link was intended, without a dead href. */
function missing(text: string): PhrasingContent {
  return {
    type: "emphasis",
    children: [plainText(text)],
    data: { hName: "span", hProperties: { className: ["wikilink-missing"] } },
  };
}

/** `![[img.png|300]]` sets a width; `![[img.png|300x200]]` sets both; other text becomes alt text. */
function image(path: string, parts: WikilinkParts): Image {
  const size = parts.alias ? /^(\d+)(?:x(\d+))?$/.exec(parts.alias) : null;
  return {
    type: "image",
    url: assetUrl(path),
    alt: size ? basename(path) : (parts.alias ?? basename(path)),
    data: size ? { hProperties: { width: size[1], ...(size[2] ? { height: size[2] } : {}) } } : {},
  };
}

/**
 * `![[voice.m4a]]` (e.g. from Obsidian's audio recorder) becomes an inline player, labelled with
 * the file name. The link inside is the fallback for browsers that can't play the format.
 */
function audio(path: string): PhrasingContent {
  const url = assetUrl(path);
  return {
    type: "emphasis",
    children: [wikilink(url, basename(path))],
    data: {
      hName: "audio",
      hProperties: { src: url, controls: true, preload: "metadata", ariaLabel: basename(path) },
    },
  };
}
