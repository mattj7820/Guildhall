import type { Code } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { parseStatblock, type Statblock } from "./parse-statblock";

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Every readable ```statblock in a note body, in order. Uses the same markdown parser as the wiki,
 * so a fence counts here exactly when it renders as a statblock there. Unreadable blocks are
 * skipped: the wiki already explains what's wrong with them.
 */
export function extractStatblocks(markdown: string): Statblock[] {
  const statblocks: Statblock[] = [];
  visit(parser.parse(markdown), "code", (node: Code) => {
    if (node.lang !== "statblock") return;
    const result = parseStatblock(node.value);
    if (result.ok) statblocks.push(result.statblock);
  });
  return statblocks;
}
