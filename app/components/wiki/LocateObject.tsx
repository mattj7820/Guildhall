import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useFetcher } from "react-router";
import { markQuery } from "~/wiki/tome";
import type { SearchHit } from "~/wiki/types";
import { noteUrl } from "~/wiki/urls";
import { RuneCircle } from "./RuneCircle";

/**
 * Searching as a spell: the words are sent to the wiki's own search (the same loader, so players
 * only ever find what they may read) as they're typed, and the notes that answer ink in.
 */
export function LocateObject({ openSlug }: { openSlug?: string }) {
  const fetcher = useFetcher<{ query: string; results: SearchHit[] }>();
  const { load } = fetcher;
  const [words, setWords] = useState("");
  const [pulse, setPulse] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const query = words.trim();

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    if (!query) return;
    const wait = setTimeout(() => load(`/wiki?index&q=${encodeURIComponent(query)}`), 140);
    return () => clearTimeout(wait);
  }, [query, load]);

  const answer = query ? fetcher.data : undefined;
  // Each answer that finds something flares the circle.
  const [flared, setFlared] = useState(answer);
  if (answer !== flared) {
    setFlared(answer);
    if (answer?.results.length) setPulse((count) => count + 1);
  }

  function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
    const first = list.current?.querySelector("a");
    if (event.key === "ArrowDown" && first) {
      event.preventDefault();
      first.focus();
    } else if (event.key === "Enter" && first) {
      event.preventDefault();
      // A click, so the page turns as for any other link.
      first.click();
    }
  }

  function onListKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [...(list.current?.querySelectorAll("a") ?? [])];
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (at < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && at === 0) input.current?.focus();
    else links[Math.min(links.length - 1, at + (event.key === "ArrowDown" ? 1 : -1))]?.focus();
  }

  const results = answer?.results ?? [];
  const status = !query
    ? "Finds words in titles, tags and text."
    : !answer
      ? "Casting…"
      : results.length === 0
        ? `Nothing answers to “${answer.query}”.`
        : `${results.length} ${results.length === 1 ? "note answers" : "notes answer"}.`;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-4">
        <RuneCircle letters={query.length} answered={results.length > 0} pulse={pulse} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="locate-object" className="font-display text-title text-lg">
            Speak the words
          </label>
          <input
            ref={input}
            id="locate-object"
            type="text"
            role="searchbox"
            autoComplete="off"
            spellCheck={false}
            value={words}
            onChange={(event) => setWords(event.target.value)}
            onKeyDown={onInputKey}
            placeholder="What are you looking for?"
            className="gh-tome-words w-full bg-transparent px-0.5 py-1 font-prose text-xl italic"
          />
          <p role="status" className="text-muted text-sm">
            {status}
          </p>
        </div>
      </div>
      {results.length > 0 && (
        <ul ref={list} aria-label="Search results" onKeyDown={onListKey} className="mt-4">
          {results.map((hit, i) => (
            <li
              key={hit.slug}
              className="gh-tome-ink border-line border-b border-dotted"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <Link
                to={noteUrl(hit.slug)}
                aria-current={hit.slug === openSlug ? "page" : undefined}
                className="gh-tome-entry flex flex-col gap-0.5 px-1 py-2"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-prose text-ink text-lg font-semibold">
                    <Marked text={hit.title} query={query} />
                  </span>
                  <span className="text-muted shrink-0 text-xs tracking-wide uppercase">
                    {folderOf(hit.slug)}
                  </span>
                </span>
                {hit.snippet && (
                  <span className="text-muted text-sm">
                    <Marked text={hit.snippet} query={query} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Marked({ text, query }: { text: string; query: string }) {
  return markQuery(text, query).map((part, i) =>
    part.marked ? (
      <mark key={i} className="gh-tome-mark">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

function folderOf(slug: string): string {
  const at = slug.lastIndexOf("/");
  return at < 0 ? "" : slug.slice(0, at).split("/").pop()!;
}
