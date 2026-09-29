import type { Blockquote, Heading, Nodes, Parent, Paragraph, Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { applyComments } from "./comments";

/**
 * DM-only parts of a note that players can see:
 *
 * - **A DM section:** a heading whose text is exactly "DM" (any level, any case, e.g. `## DM`),
 *   and everything after it up to the next heading of the same or a higher level, or the end of
 *   the note (or of the list item or quote it's in).
 * - **A DM callout:** an Obsidian callout `> [!dm] optional title`, with or without a fold
 *   marker (`[!dm]-`, `[!dm]+`).
 *
 * Both stay readable in Obsidian. Players never receive them; the DM sees them boxed. The same
 * markdown parser as the wiki decides what's a heading or a quote, so what's hidden is exactly
 * what renders as a DM part.
 */

const parser = unified().use(remarkParse).use(remarkGfm);

const CALLOUT_MARKER = /^\s*\[!dm\][+-]?/i;

/** A DM part: `count` consecutive children of `parent`, starting at `index`. */
export interface DmPart {
  kind: "section" | "callout";
  parent: Parent;
  index: number;
  count: number;
}

/** Every DM part in a parsed note, outermost first. Parts inside parts are included. */
export function findDmParts(tree: Root): DmPart[] {
  const parts: DmPart[] = [];
  const walk = (parent: Parent) => {
    parent.children.forEach((child, index) => {
      if (child.type === "heading" && isDmHeading(child)) {
        const end = parent.children.findIndex(
          (sibling, at) => at > index && sibling.type === "heading" && sibling.depth <= child.depth,
        );
        const count = (end === -1 ? parent.children.length : end) - index;
        parts.push({ kind: "section", parent, index, count });
      } else if (child.type === "blockquote" && isDmCallout(child)) {
        parts.push({ kind: "callout", parent, index, count: 1 });
      }
      if ("children" in child) walk(child as Parent);
    });
  };
  walk(tree);
  return parts;
}

function isDmHeading(heading: Heading): boolean {
  return plainText(heading).trim().toLowerCase() === "dm";
}

export function isDmCallout(quote: Blockquote): boolean {
  const first = quote.children[0];
  const text = first?.type === "paragraph" ? first.children[0] : undefined;
  return text?.type === "text" && CALLOUT_MARKER.test(text.value);
}

/** The words of a node, leaving out raw HTML (a `## DM <!-- note -->` heading is still "DM"). */
function plainText(node: Nodes): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "html") return "";
  return "children" in node ? (node.children as Nodes[]).map(plainText).join("") : "";
}

/**
 * A note's markdown as players may see it: `%%comments%%` removed, then every DM section and DM
 * callout removed. This is the one place player text is made; the page, search and statblocks
 * for players all come from it.
 */
export function forPlayers(markdown: string): string {
  // Comments first: that also normalises line endings, so offsets below match this string.
  const text = applyComments(markdown, "player");
  const ranges = findDmParts(parser.parse(text))
    .map(({ parent, index, count }) => {
      const start = parent.children[index].position?.start.offset;
      const end = sectionEnd(parent, index + count, text.length);
      return start === undefined ? undefined : ([start, end] as const);
    })
    .filter((range) => range !== undefined)
    .sort((a, b) => a[0] - b[0]);

  let result = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    // Parts inside parts are already gone with their outer part.
    if (end <= cursor) continue;
    result += text.slice(cursor, Math.max(start, cursor));
    cursor = Math.max(cursor, end);
  }
  return result + text.slice(cursor);
}

/**
 * Where a part ending before child `next` of `parent` ends in the text: at that child if there is
 * one, otherwise at the end of the parent's last child (or of the whole note, for the root).
 */
function sectionEnd(parent: Parent, next: number, textLength: number): number {
  const following = parent.children[next] as RootContent | undefined;
  if (following?.position) return following.position.start.offset!;
  if (parent.type === "root") return textLength;
  const last = parent.children[parent.children.length - 1];
  return last.position?.end.offset ?? textLength;
}

/** Removes the `[!dm]` marker from the start of a DM callout, for the DM's boxed view. */
export function stripCalloutMarker(quote: Blockquote): void {
  const first = quote.children[0] as Paragraph;
  const text = first.children[0];
  if (text.type !== "text") return;
  text.value = text.value.replace(CALLOUT_MARKER, "").replace(/^[ \t]*\n?/, "");
  if (text.value === "") first.children.shift();
  if (first.children.length === 0) quote.children.shift();
}
