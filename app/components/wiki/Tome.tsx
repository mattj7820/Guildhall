import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { chapterOf, chaptersOf, slugOf, type Chapter } from "~/wiki/tome";
import type { FolderNode } from "~/wiki/types";
import { noteUrl } from "~/wiki/urls";
import { LocateObject } from "./LocateObject";
import { usePageTurn } from "./usePageTurn";

type Spell = "locate";

/**
 * The wiki as an open book, for those who pick it in Settings: the vault's top folders are
 * ribbons, the left page holds the spells and the chapter's contents, and the right page is the
 * note, which turns like a page. Only a look: the notes, tree and search are the wiki's own.
 * On phones it's one page, with the left page opened from a bar at the bottom.
 */
export function Tome({ tree, children }: { tree: FolderNode; children: ReactNode }) {
  const { pathname } = useLocation();
  const chapters = useMemo(() => chaptersOf(tree), [tree]);
  const openSlug = slugOf(pathname);
  const [chapterKey, setChapterKey] = useState(
    () => chapterOf(openSlug, chapters) ?? chapters[0]?.key,
  );
  const [spell, setSpell] = useState<Spell | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const left = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const spellButton = useRef<HTMLButtonElement>(null);
  usePageTurn(left, page, layer);

  // Opening a note shows its chapter, and on phones closes the left page to read it.
  const [shownSlug, setShownSlug] = useState(openSlug);
  if (shownSlug !== openSlug) {
    setShownSlug(openSlug);
    const key = chapterOf(openSlug, chapters);
    if (key !== undefined) setChapterKey(key);
    setSheetOpen(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "/" && !isTyping(event.target)) {
        event.preventDefault();
        setSpell("locate");
        setSheetOpen(true);
        document.getElementById("locate-object")?.focus();
      } else if (event.key === "Escape") {
        setSpell((casting) => {
          if (casting) requestAnimationFrame(() => spellButton.current?.focus());
          return null;
        });
        setSheetOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const chapter = chapters.find((c) => c.key === chapterKey) ?? chapters[0];
  const noteCount = countNotes(tree);

  function cast(next: Spell) {
    setSpell((casting) => (casting === next ? null : next));
    setSheetOpen(true);
  }

  function openChapter(key: string) {
    setChapterKey(key);
    setSpell(null);
    setSheetOpen(true);
  }

  return (
    <div className="gh-tome-desk px-4 pt-8 pb-10 max-md:pt-6 max-md:pb-28">
      <div className="gh-tome relative mx-auto max-w-6xl">
        <div
          role="group"
          aria-label="Chapters"
          className="absolute -top-1 right-4 left-6 z-40 flex gap-1.5 overflow-x-auto [scrollbar-width:none] md:left-10"
        >
          {chapters.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={!spell && c.key === chapter?.key}
              onClick={() => openChapter(c.key)}
              className="gh-tome-ribbon shrink-0 px-2 pt-2 pb-4 text-xs font-semibold tracking-wide"
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="gh-tome-spread relative grid md:grid-cols-2">
          <section
            ref={left}
            aria-label="Spells and contents"
            data-open={sheetOpen || undefined}
            className="gh-tome-page gh-tome-left min-w-0 px-6 pt-12 pb-10 md:px-10"
          >
            <p className="text-muted text-xs font-semibold tracking-[0.14em] uppercase">
              The wiki · {noteCount} {noteCount === 1 ? "note" : "notes"}
            </p>
            <div role="group" aria-label="Spells" className="mt-3 grid grid-cols-2 gap-2">
              <button
                ref={spellButton}
                type="button"
                aria-pressed={spell === "locate"}
                onClick={() => cast("locate")}
                className="gh-tome-spell flex flex-col gap-0.5 rounded-md px-3 py-2 text-left"
              >
                <span className="text-link flex justify-between text-[0.68rem] font-semibold tracking-wider uppercase">
                  <span>Cantrip</span>
                  <kbd className="border-line text-muted rounded border px-1 font-sans">/</kbd>
                </span>
                <span className="font-display text-title text-lg leading-tight">Locate Object</span>
                <span className="text-muted text-sm">Search every note</span>
              </button>
            </div>
            {spell === "locate" ? (
              <>
                <LocateObject openSlug={openSlug} />
                <button
                  type="button"
                  onClick={() => setSpell(null)}
                  className="text-link mt-4 text-sm underline underline-offset-4"
                >
                  End the spell (Esc)
                </button>
              </>
            ) : (
              chapter && <Contents chapter={chapter} />
            )}
          </section>
          <div
            ref={page}
            className="gh-tome-page gh-tome-right relative min-w-0 px-6 pt-12 pb-12 md:px-12"
          >
            {children}
            <div ref={layer} className="gh-tome-turn" aria-hidden="true" inert />
          </div>
        </div>
        <span className="gh-tome-clasp max-md:hidden" aria-hidden="true" />
      </div>
      <nav aria-label="Tome" className="gh-tome-dock fixed inset-x-0 bottom-0 z-40 flex md:hidden">
        <button
          type="button"
          aria-pressed={sheetOpen && !spell}
          onClick={() => {
            setSpell(null);
            setSheetOpen((open) => !(open && !spell));
          }}
          className="flex flex-1 flex-col items-center py-2"
        >
          <span className="font-display text-base">Contents</span>
          <span className="text-[0.62rem] tracking-wider uppercase opacity-75">
            {chapter?.name}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={sheetOpen && spell === "locate"}
          onClick={() => {
            if (sheetOpen && spell === "locate") return setSheetOpen(false);
            setSpell("locate");
            setSheetOpen(true);
          }}
          className="flex flex-1 flex-col items-center py-2"
        >
          <span className="font-display text-base">Locate Object</span>
          <span className="text-[0.62rem] tracking-wider uppercase opacity-75">Search</span>
        </button>
      </nav>
    </div>
  );
}

/** The chapter's notes, with its folders as sections. */
function Contents({ chapter }: { chapter: Chapter }) {
  const count = countNotes(chapter.folder);
  return (
    <div className="mt-6">
      <h2 className="font-display text-title text-2xl">{chapter.name}</h2>
      <p className="text-muted mt-1 text-sm">
        {count} {count === 1 ? "note" : "notes"} in this chapter.
      </p>
      <FolderEntries folder={chapter.folder} />
    </div>
  );
}

function FolderEntries({ folder, depth = 0 }: { folder: FolderNode; depth?: number }) {
  return (
    <>
      {folder.notes.length > 0 && (
        <ul className="mt-2">
          {folder.notes.map((note) => (
            <li key={note.slug} className="border-line border-b border-dotted">
              <NavLink
                to={noteUrl(note.slug)}
                className="gh-tome-entry font-prose text-ink flex items-baseline justify-between gap-3 px-1 py-1.5 text-lg"
              >
                <span className="min-w-0 truncate">{note.title}</span>
                {note.type && (
                  <span className="text-muted shrink-0 text-xs tracking-wide uppercase">
                    {note.type}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      {folder.folders.map((child) => (
        <section key={child.path} className="mt-4">
          <h3
            className={`font-display text-muted ${depth === 0 ? "text-lg" : "text-base"} leading-tight`}
          >
            {child.name}
          </h3>
          <FolderEntries folder={child} depth={depth + 1} />
        </section>
      ))}
    </>
  );
}

function countNotes(folder: FolderNode): number {
  return folder.notes.length + folder.folders.reduce((sum, child) => sum + countNotes(child), 0);
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
