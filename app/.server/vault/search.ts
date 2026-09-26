import MiniSearch from "minisearch";
import type { Note } from "./parse-note";

export interface SearchResult {
  note: Note;
  snippet: string;
}

interface SearchDocument {
  id: string;
  title: string;
  aliases: string;
  tags: string;
  text: string;
}

/**
 * Full-text search over a fixed set of notes. Build one index per audience, from text that has
 * already had anything that audience mustn't see removed, so hidden content can't match a query.
 */
export class SearchIndex {
  private readonly index = new MiniSearch<SearchDocument>({
    fields: ["title", "aliases", "tags", "text"],
    searchOptions: { boost: { title: 3, aliases: 2, tags: 1.5 }, prefix: true, fuzzy: 0.2 },
  });
  private readonly entries = new Map<string, { note: Note; text: string }>();

  constructor(documents: { note: Note; markdown: string }[]) {
    for (const { note, markdown } of documents) {
      const text = toPlainText(markdown);
      this.entries.set(note.path, { note, text });
      this.index.add({
        id: note.path,
        title: note.title,
        aliases: note.aliases.join(" "),
        tags: note.tags.join(" "),
        text,
      });
    }
  }

  search(query: string, limit = 50): SearchResult[] {
    if (!query.trim()) return [];
    return this.index
      .search(query)
      .slice(0, limit)
      .map((hit) => {
        const entry = this.entries.get(String(hit.id))!;
        return { note: entry.note, snippet: snippet(entry.text, hit.terms) };
      });
  }
}

/** Markdown → readable text for indexing and snippets. Deliberately rough. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>~|%-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(text: string, terms: string[], radius = 80): string {
  const lower = text.toLowerCase();
  const position = Math.min(
    ...terms.map((term) => lower.indexOf(term.toLowerCase())).filter((index) => index >= 0),
  );
  if (!Number.isFinite(position)) return text.slice(0, radius * 2);
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
