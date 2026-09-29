import type {
  Blockquote,
  Heading,
  Nodes,
  Parent,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
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

/**
 * For the DM's view: boxes every DM part. A DM section, its heading included, is wrapped in
 * `div.dm-section`; a DM callout becomes `div.dm-callout` without its `[!dm]` marker. Parts
 * inside parts are boxed too, so anything not in a box is something players see.
 */
export function remarkDmParts() {
  return (tree: Root) => {
    const parts = findDmParts(tree);
    // Collected before any wrapping, which moves nodes and shifts indexes.
    const callouts = parts
      .filter((part) => part.kind === "callout")
      .map(({ parent, index }) => parent.children[index] as Blockquote);
    const sections = parts.filter((part) => part.kind === "section");
    const outermost = sections.filter(
      (part) =>
        !sections.some(
          (other) =>
            other !== part &&
            other.parent === part.parent &&
            other.index < part.index &&
            part.index < other.index + other.count,
        ),
    );

    // Last first, so wrapping one section doesn't shift the indexes of those before it.
    for (const { parent, index, count } of outermost.sort((a, b) => b.index - a.index)) {
      const box = { type: "dmSection", data: dmBox("dm-section"), children: [] as RootContent[] };
      box.children = parent.children.splice(index, count, box as unknown as RootContent);
    }
    for (const quote of callouts) {
      stripCalloutMarker(quote);
      quote.data = { ...quote.data, ...dmBox("dm-callout") };
    }
  };
}

/** Tells the HTML conversion to make a node a `div` with the given class. */
function dmBox(className: string) {
  return { hName: "div", hProperties: { className: [className] } };
}

/**
 * Removes the `[!dm]` marker from the start of a DM callout, for the DM's boxed view. A title
 * after the marker (`> [!dm] Who they work for`) becomes a bold first line, as in Obsidian.
 */
function stripCalloutMarker(quote: Blockquote): void {
  const first = quote.children[0] as Paragraph;
  const text = first.children[0];
  if (text.type !== "text") return;
  const afterMarker = text.value.replace(CALLOUT_MARKER, "").replace(/^[ \t]+/, "");
  const lineEnd = afterMarker.indexOf("\n");
  const title = (lineEnd === -1 ? afterMarker : afterMarker.slice(0, lineEnd)).trim();
  const rest = lineEnd === -1 ? "" : afterMarker.slice(lineEnd + 1);
  const isWholeParagraph = lineEnd !== -1 || first.children.length === 1;

  if (!title) {
    text.value = rest;
    if (!rest) first.children.shift();
  } else if (isWholeParagraph) {
    // The title is plain text on a line of its own: make it the callout's bold first line.
    const titleNodes: PhrasingContent[] = [
      { type: "strong", children: [{ type: "text", value: title }] },
    ];
    if (rest) titleNodes.push({ type: "break" }, { type: "text", value: rest });
    first.children.splice(0, 1, ...titleNodes);
  } else {
    // A title with formatting or links in it: leave it as it is, just without the marker.
    text.value = afterMarker;
  }
  if (first.children.length === 0) quote.children.shift();
}
