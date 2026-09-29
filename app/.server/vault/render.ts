import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Role } from "~/campaign/types";
import { applyComments } from "./comments";
import { forPlayers } from "./dm-parts";
import { remarkWikilinks, type WikilinkOptions } from "./remark-wikilinks";
import { rehypeStatblocks } from "./statblock/rehype-statblocks";

/**
 * Raw HTML in notes is allowed (Obsidian users write it), but sanitised: no scripts, no event
 * handlers, and only the class names this app generates itself.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "audio"],
  attributes: {
    ...defaultSchema.attributes,
    a: allowClasses("a", ["wikilink", "wikilink-embed"]),
    span: allowClasses("span", ["wikilink-missing", "dm-comment"]),
    div: allowClasses("div", ["dm-comment"]),
    audio: ["src", "controls", "preload", "ariaLabel"],
  },
};

/** Adds class names to a tag's allowlist, merging with any the default schema already allows. */
function allowClasses(tag: string, classes: string[]) {
  const existing = defaultSchema.attributes?.[tag] ?? [];
  const isClassRule = (rule: (typeof existing)[number]) =>
    Array.isArray(rule) && rule[0] === "className";
  const defaultClasses = existing
    .filter(isClassRule)
    .flatMap((rule) => (rule as string[]).slice(1));
  return [
    ...existing.filter((rule) => !isClassRule(rule)),
    ["className", ...defaultClasses, ...classes] as [string, ...string[]],
  ];
}

export interface RenderOptions extends WikilinkOptions {
  role: Role;
}

/** Renders a note's markdown body to sanitised HTML for the given viewer role. */
export function renderMarkdown(markdown: string, options: RenderOptions): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    // After sanitising, so heading IDs aren't prefixed and match the anchors wikilinks point at.
    .use(rehypeSlug)
    // Also after sanitising: statblock markup is app-generated, with vault text as text nodes only.
    .use(rehypeStatblocks)
    .use(rehypeStringify);

  // Players get only what they may see; everything below (wikilinks, and so which images they may
  // load) works on that.
  const source = options.role === "player" ? forPlayers(markdown) : applyComments(markdown, "dm");
  return String(processor.processSync(source));
}
