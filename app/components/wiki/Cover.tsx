import { useState } from "react";
import { useFetcher } from "react-router";

/**
 * The tome's front cover, the wiki's front page: leather with a tooled border, the campaign's
 * name stamped in gilt, and a drawn emblem. The name is the DM's own (set here, on the cover);
 * until there is one the cover just says what the book is. The emblem is pure geometry.
 */
export function CoverFront({
  name,
  canName,
  bookFolder,
  folders,
  onOpen,
}: {
  name?: string;
  canName: boolean;
  /** For the DM: which top folder is the book, and those to choose from. */
  bookFolder?: string;
  folders: string[];
  onOpen: () => void;
}) {
  const [naming, setNaming] = useState(false);
  return (
    <div className="gh-tome-cover-front" data-naming={naming || undefined}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${name ?? "the campaign wiki"}`}
        className="gh-cover-face"
      >
        <span className="gh-cover-frame" aria-hidden="true">
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <Corner key={corner} corner={corner} />
          ))}
        </span>
        <span className="gh-cover-title font-display" aria-hidden="true">
          {name ?? "Campaign wiki"}
        </span>
        <Rule />
        <Emblem />
        <span className="gh-cover-hint" aria-hidden="true">
          Open the book
        </span>
      </button>
      {canName &&
        (naming ? (
          <NameForm
            name={name}
            bookFolder={bookFolder}
            folders={folders}
            onDone={() => setNaming(false)}
          />
        ) : (
          <button type="button" onClick={() => setNaming(true)} className="gh-cover-rename">
            {name ? "Change the cover" : "Name the campaign"}
          </button>
        ))}
    </div>
  );
}

function NameForm({
  name,
  bookFolder,
  folders,
  onDone,
}: {
  name?: string;
  bookFolder?: string;
  folders: string[];
  onDone: () => void;
}) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form
      method="post"
      action="/wiki?index"
      onSubmit={() => setTimeout(onDone)}
      className="gh-cover-naming"
    >
      <label htmlFor="campaign-name" className="sr-only">
        The campaign&apos;s name
      </label>
      <input
        id="campaign-name"
        name="campaignName"
        defaultValue={name}
        maxLength={60}
        autoFocus
        autoComplete="off"
        placeholder="The campaign's name"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onDone();
          }
        }}
        className="gh-cover-input font-display"
      />
      <label className="flex items-center gap-2 text-sm">
        <span>The book is</span>
        <select name="bookFolder" defaultValue={bookFolder ?? ""} className="gh-cover-select">
          <option value="">the whole vault</option>
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              the {folder} folder
            </option>
          ))}
        </select>
      </label>
      <span className="flex gap-2">
        <button type="submit" className="gh-cover-rename">
          Save
        </button>
        <button type="button" onClick={onDone} className="gh-cover-rename">
          Cancel
        </button>
      </span>
    </fetcher.Form>
  );
}

/** A corner piece: a tooled bracket with a leaf and a stud, turned for each corner. */
function Corner({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const turn = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
  return (
    <svg
      viewBox="0 0 80 80"
      className={`gh-cover-corner gh-cover-corner-${corner}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <g transform={`rotate(${turn} 40 40)`}>
        <path d="M6 52 V12 a6 6 0 0 1 6-6 H52" strokeWidth="2" />
        <path d="M14 40 V18 a4 4 0 0 1 4-4 H40" strokeWidth="1.2" />
        <path d="M16 16 C 28 18, 34 24, 36 36 C 24 34, 18 28, 16 16 Z" strokeWidth="1.2" />
        <circle cx="6" cy="6" r="3.2" fill="currentColor" stroke="none" />
        <circle cx="52" cy="6" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="6" cy="52" r="1.8" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function Rule() {
  return (
    <svg viewBox="0 0 200 12" className="gh-cover-rule" aria-hidden="true" fill="none">
      <path d="M4 6 H86 M114 6 H196" stroke="currentColor" strokeWidth="1.2" />
      <path d="M100 1 L105 6 L100 11 L95 6 Z" fill="currentColor" />
      <circle cx="90" cy="6" r="1.5" fill="currentColor" />
      <circle cx="110" cy="6" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** A rosette of circles and an eight-pointed star: ornament only. */
function Emblem() {
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? 46 : 20;
    return `${(60 + Math.cos(angle) * r).toFixed(1)},${(60 + Math.sin(angle) * r).toFixed(1)}`;
  }).join(" ");
  const dots = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * Math.PI) / 12;
    return { x: 60 + Math.cos(angle) * 54, y: 60 + Math.sin(angle) * 54 };
  });
  return (
    <svg viewBox="0 0 120 120" className="gh-cover-emblem" aria-hidden="true" fill="none">
      <circle cx="60" cy="60" r="58" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="0.8" />
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r="1.1" fill="currentColor" />
      ))}
      <polygon points={points} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="60" cy="60" r="12" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="4" fill="currentColor" />
    </svg>
  );
}

/** The open book's first page: the campaign's name, set like a book's title page. */
export function TitlePage({ name, noteCount }: { name?: string; noteCount: number }) {
  return (
    <main className="gh-title-page flex min-h-full flex-col items-center justify-center py-12 text-center">
      <h1 className="font-display text-title text-5xl">{name ?? "Campaign wiki"}</h1>
      <Rule />
      <p className="text-muted mt-4 italic">
        {noteCount} {noteCount === 1 ? "note" : "notes"}. Pick one from the contents, or cast a
        spell to find one.
      </p>
    </main>
  );
}
