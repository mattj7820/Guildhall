import type { Role } from "~/campaign/types";

/**
 * Obsidian `%%comments%%` are the DM's inline secrets: hidden in Obsidian's reading view, and
 * so hidden from players here. This runs on the raw markdown *before* parsing, because a comment
 * can span several paragraphs, which a markdown AST would split apart.
 *
 * - Player view: comments are removed entirely, so they reach neither the page nor the search index.
 * - DM view: comments are kept, rendered as highlighted "DM note" elements (as escaped plain text).
 *
 * `%%` inside inline code or fenced code blocks is literal text, as in Obsidian. An unclosed `%%`
 * hides the rest of the note, which is also what Obsidian does, and fails closed for players.
 */
export function applyComments(markdown: string, role: Role): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let fence: string | undefined;
  let comment: { text: string[]; startedAtLineStart: boolean; prefix: string } | undefined;

  for (const line of lines) {
    if (!comment && fence === undefined) {
      const opening = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (opening) {
        fence = opening[1];
        output.push(line);
        continue;
      }
    } else if (!comment && fence !== undefined) {
      if (new RegExp(`^\\s{0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = undefined;
      output.push(line);
      continue;
    }

    let rest = line;
    let built = "";
    while (rest.length > 0 || comment) {
      if (comment) {
        const end = rest.indexOf("%%");
        if (end === -1) {
          comment.text.push(rest);
          break;
        }
        comment.text.push(rest.slice(0, end));
        rest = rest.slice(end + 2);
        const isBlock = comment.startedAtLineStart && rest.trim() === "" && comment.text.length > 1;
        built = comment.prefix + render(comment.text, isBlock, role);
        comment = undefined;
        continue;
      }

      const start = findCommentStart(rest);
      if (start === -1) {
        built += rest;
        break;
      }
      comment = {
        text: [],
        startedAtLineStart: (built + rest.slice(0, start)).trim() === "",
        prefix: built + rest.slice(0, start),
      };
      built = "";
      rest = rest.slice(start + 2);
    }

    if (!comment) output.push(built);
  }

  // An unclosed comment swallows the rest of the note.
  if (comment) {
    const kept = comment.prefix + (role === "dm" ? render(comment.text, true, role) : "");
    output.push(kept);
  }

  return output.join("\n");
}

/** Index of the first `%%` outside an inline code span, or -1. */
function findCommentStart(text: string): number {
  let index = 0;
  while (index < text.length) {
    if (text[index] === "`") {
      const run = /^`+/.exec(text.slice(index))![0];
      const close = text.indexOf(run, index + run.length);
      if (close === -1) {
        index += run.length;
        continue;
      }
      index = close + run.length;
      continue;
    }
    if (text.startsWith("%%", index)) return index;
    index++;
  }
  return -1;
}

function render(textLines: string[], isBlock: boolean, role: Role): string {
  if (role === "player") return "";
  const content = textLines.map(escapeHtml).join("\n").trim();
  if (!content) return "";
  if (isBlock) {
    // A single-line HTML block, so blank lines inside the comment can't end it early.
    return `<div class="dm-comment">${content.replace(/\n/g, "<br>")}</div>`;
  }
  return `<span class="dm-comment">${content.replace(/\n/g, " ")}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
