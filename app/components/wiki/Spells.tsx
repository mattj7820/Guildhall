import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useFetcher } from "react-router";
import { byTitle } from "~/wiki/tome";
import type { NoteSummary, SearchHit } from "~/wiki/types";
import { NoteList } from "./NoteList";
import { RuneCircle } from "./RuneCircle";

/**
 * The tome's spells: each is only a way into the wiki's own data, as this viewer may see it.
 * Locate Object searches with the wiki's search, Misty Step jumps by name through the tree,
 * Detect Magic lists notes by tag, and Scrying shows what links to the open note.
 */

/** The circle beside the spell's words, with what the spell is waiting for or has found. */
function Casting({
  letters = 0,
  answered,
  pulse = 0,
  label,
  status,
  children,
}: {
  letters?: number;
  answered: boolean;
  pulse?: number;
  label?: ReactNode;
  status: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5 flex items-center gap-4">
      <RuneCircle letters={letters} answered={answered} pulse={pulse} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label}
        {children}
        <p role="status" className="text-muted text-sm">
          {status}
        </p>
      </div>
    </div>
  );
}

/** The spoken words: an input that hands Down and Enter to the list below it. */
function Words({
  id,
  label,
  placeholder,
  value,
  onChange,
  list,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  list: RefObject<HTMLUListElement | null>;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const first = list.current?.querySelector("a");
    if (!first) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      first.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      // A click, so the note arrives as from any other link.
      first.click();
    }
  }
  return (
    <>
      <label htmlFor={id} className="font-display text-title text-lg">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="searchbox"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="gh-tome-words font-prose w-full bg-transparent px-0.5 py-1 text-xl italic"
      />
    </>
  );
}

function focusWords(id: string) {
  document.getElementById(id)?.focus();
}

/** Each answer that finds something flares the circle once. */
function usePulse(answer: unknown, found: boolean) {
  const [pulse, setPulse] = useState(0);
  const [seen, setSeen] = useState(answer);
  if (answer !== seen) {
    setSeen(answer);
    if (found) setPulse((count) => count + 1);
  }
  return pulse;
}

export function LocateObject({ openSlug }: { openSlug?: string }) {
  const fetcher = useFetcher<{ query: string; results: SearchHit[] }>();
  const { load } = fetcher;
  const [words, setWords] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const query = words.trim();

  useEffect(() => {
    if (!query) return;
    // The wiki's own search, so players only ever find what they may read.
    const wait = setTimeout(() => load(`/wiki?index&q=${encodeURIComponent(query)}`), 140);
    return () => clearTimeout(wait);
  }, [query, load]);

  const answer = query ? fetcher.data : undefined;
  const results = answer?.results ?? [];
  const pulse = usePulse(answer, results.length > 0);
  const status = !query
    ? "Finds words in titles, tags and text."
    : !answer
      ? "Casting…"
      : results.length === 0
        ? `Nothing answers to “${answer.query}”.`
        : `${results.length} ${results.length === 1 ? "note answers" : "notes answer"}.`;

  return (
    <>
      <Casting letters={query.length} answered={results.length > 0} pulse={pulse} status={status}>
        <Words
          id="locate-object"
          label="Speak the words"
          placeholder="What are you looking for?"
          value={words}
          onChange={setWords}
          list={list}
        />
      </Casting>
      {results.length > 0 && (
        <NoteList
          notes={results}
          label="Search results"
          query={query}
          openSlug={openSlug}
          listRef={list}
          back={() => focusWords("locate-object")}
        />
      )}
    </>
  );
}

export function MistyStep({
  notes,
  openSlug,
  onStep,
}: {
  notes: NoteSummary[];
  openSlug?: string;
  /** Called as a note is picked, so it arrives through mist rather than a turned page. */
  onStep: () => void;
}) {
  const [words, setWords] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const query = words.trim();
  const found = query ? byTitle(notes, query, 12) : [];
  const pulse = usePulse(found[0]?.slug, found.length > 0);
  const status = !query
    ? "Enter takes you to the first match."
    : found.length === 0
      ? "No note by that name."
      : `Enter steps to ${found[0].title}.`;

  return (
    <>
      <Casting letters={query.length} answered={found.length > 0} pulse={pulse} status={status}>
        <Words
          id="misty-step"
          label="Name the place"
          placeholder="Part of a note's name"
          value={words}
          onChange={setWords}
          list={list}
        />
      </Casting>
      {found.length > 0 && (
        <NoteList
          notes={found}
          label="Notes by name"
          query={query}
          openSlug={openSlug}
          listRef={list}
          back={() => focusWords("misty-step")}
          onPick={onStep}
        />
      )}
    </>
  );
}

export function DetectMagic({
  tags,
  openSlug,
}: {
  tags: { tag: string; notes: NoteSummary[] }[];
  openSlug?: string;
}) {
  const [picked, setPicked] = useState<string | undefined>();
  const aura = tags.find((t) => t.tag === picked);
  const pulse = usePulse(picked, aura !== undefined);
  const status =
    tags.length === 0
      ? "No note here carries a tag."
      : aura
        ? `${aura.notes.length} ${aura.notes.length === 1 ? "note carries" : "notes carry"} #${aura.tag}.`
        : "Pick a tag to see what carries it.";

  return (
    <>
      <Casting
        letters={aura ? Math.min(16, aura.notes.length) : 0}
        answered={aura !== undefined}
        pulse={pulse}
        status={status}
        label={<h3 className="font-display text-title text-lg">Auras in this tome</h3>}
      />
      <div role="group" aria-label="Tags" className="mt-3 flex flex-wrap gap-1.5">
        {tags.map(({ tag, notes }) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tag === picked}
            onClick={() => setPicked(tag === picked ? undefined : tag)}
            className="gh-tome-aura rounded-full px-2.5 py-0.5 text-sm"
          >
            #{tag}
            <span className="text-muted ml-1 text-xs">{notes.length}</span>
          </button>
        ))}
      </div>
      {aura && (
        <NoteList
          key={aura.tag}
          notes={aura.notes}
          label={`Notes tagged ${aura.tag}`}
          openSlug={openSlug}
        />
      )}
    </>
  );
}

export function Scrying({
  note,
  openSlug,
}: {
  /** The open note and what links to it; none on the wiki's own pages. */
  note?: { title: string; linkedFrom: NoteSummary[] };
  openSlug?: string;
}) {
  const found = note?.linkedFrom ?? [];
  const pulse = usePulse(note, found.length > 0);
  const status = !note
    ? "Open a note to see what mentions it."
    : found.length === 0
      ? "No note mentions it yet."
      : `${found.length} ${found.length === 1 ? "note mentions" : "notes mention"} it.`;

  return (
    <>
      <Casting
        letters={Math.min(16, found.length)}
        answered={found.length > 0}
        pulse={pulse}
        status={status}
        label={
          <h3 className="font-display text-title text-lg">
            {note ? <>Seen from afar: {note.title}</> : "Seen from afar"}
          </h3>
        }
      />
      {found.length > 0 && (
        <NoteList key={openSlug} notes={found} label="Notes that link here" openSlug={openSlug} />
      )}
    </>
  );
}
