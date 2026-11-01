import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { NavLink, useLocation, useRouteLoaderData } from "react-router";
import {
  chapterOf,
  chaptersOf,
  notesIn,
  slugOf,
  SPELLS,
  type Chapter,
  type SpellId,
} from "~/wiki/tome";
import type { FolderNode, NoteSummary } from "~/wiki/types";
import { noteUrl } from "~/wiki/urls";
import { DetectMagic, LocateObject, MistyStep, Scrying } from "./Spells";
import { usePageTurn } from "./usePageTurn";

/** Each spell's input, focused when it's cast from the keyboard. */
const WORDS: Partial<Record<SpellId, string>> = { locate: "locate-object", misty: "misty-step" };

/**
 * The wiki as an open book, for those who pick it in Settings: the vault's top folders are
 * ribbons, the left page holds the spells and the chapter's contents, and the right page is the
 * note, which turns like a page. Only a look: the notes, tree and search are the wiki's own.
 * On phones it's one page, with the left page opened from a bar at the bottom.
 */
export function Tome({
  tree,
  tags,
  children,
}: {
  tree: FolderNode;
  tags: { tag: string; notes: NoteSummary[] }[];
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const chapters = useMemo(() => chaptersOf(tree), [tree]);
  const allNotes = useMemo(() => notesIn(tree), [tree]);
  const openSlug = slugOf(pathname);
  const openNote = useRouteLoaderData("routes/wiki-note") as
    { title: string; linkedFrom: NoteSummary[] } | undefined;
  const [chapterKey, setChapterKey] = useState(
    () => chapterOf(openSlug, chapters) ?? chapters[0]?.key,
  );
  const [spell, setSpell] = useState<SpellId | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const left = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const desk = useRef<HTMLDivElement>(null);
  useBookHeight(desk);
  const spellButtons = useRef(new Map<SpellId, HTMLButtonElement>());
  const arriveByMist = usePageTurn(left, page, scroller, layer);

  // Opening a note shows its chapter, and on phones closes the left page to read it.
  const [shownSlug, setShownSlug] = useState(openSlug);
  if (shownSlug !== openSlug) {
    setShownSlug(openSlug);
    const key = chapterOf(openSlug, chapters);
    if (key !== undefined) setChapterKey(key);
    setSheetOpen(false);
  }

  useEffect(() => {
    function cast(next: SpellId) {
      setSpell(next);
      setSheetOpen(true);
      const words = WORDS[next];
      if (words) requestAnimationFrame(() => document.getElementById(words)?.focus());
    }
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        cast("misty");
      } else if (event.ctrlKey || event.metaKey) {
        return;
      } else if (event.key === "/" && !isTyping(event.target)) {
        event.preventDefault();
        cast("locate");
      } else if (event.key === "Escape") {
        setSpell((casting) => {
          if (casting) requestAnimationFrame(() => spellButtons.current.get(casting)?.focus());
          return null;
        });
        setSheetOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const chapter = chapters.find((c) => c.key === chapterKey) ?? chapters[0];

  function toggle(next: SpellId) {
    setSpell((casting) => (casting === next ? null : next));
    setSheetOpen(true);
  }

  function openChapter(key: string) {
    setChapterKey(key);
    setSpell(null);
    setSheetOpen(true);
  }

  return (
    <div ref={desk} className="gh-tome-desk px-4 pt-6 max-md:px-2 max-md:pt-3">
      <div className="gh-tome relative mx-auto max-w-6xl">
        <div
          role="group"
          aria-label="Chapters"
          className="gh-tome-ribbons absolute -top-1 right-4 left-6 z-40 flex gap-1 overflow-x-auto [scrollbar-width:none] md:left-10"
        >
          {chapters.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={!spell && c.key === chapter?.key}
              onClick={() => openChapter(c.key)}
              className="gh-tome-ribbon shrink-0 px-2.5 pt-2 pb-4 text-xs font-semibold tracking-wide"
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="gh-tome-spread relative grid h-full grid-rows-[minmax(0,1fr)] md:grid-cols-2">
          <section
            ref={left}
            aria-label="Spells and contents"
            data-open={sheetOpen || undefined}
            className="gh-tome-page gh-tome-left flex min-w-0 flex-col"
          >
            <div className="gh-tome-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-12 pb-10 md:px-10">
              <p className="text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                The wiki · {allNotes.length} {allNotes.length === 1 ? "note" : "notes"}
              </p>
              <div
                role="group"
                aria-label="Spells"
                className="mt-2 grid grid-cols-2 gap-x-6 max-md:hidden"
              >
                {SPELLS.map((s) => (
                  <button
                    key={s.id}
                    ref={(button) => {
                      if (button) spellButtons.current.set(s.id, button);
                    }}
                    type="button"
                    aria-pressed={spell === s.id}
                    aria-keyshortcuts={s.key?.replace(" ", "+")}
                    onClick={() => toggle(s.id)}
                    className="gh-tome-spell flex flex-col py-1.5 text-left"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="gh-tome-spell-name font-display text-lg leading-tight">
                        {s.name}
                      </span>
                      {s.key && <kbd className="text-muted font-sans text-[0.68rem]">{s.key}</kbd>}
                    </span>
                    <span className="text-muted text-sm italic">{s.does}</span>
                  </button>
                ))}
              </div>
              {spell ? (
                <>
                  {spell === "locate" && <LocateObject openSlug={openSlug} />}
                  {spell === "misty" && (
                    <MistyStep notes={allNotes} openSlug={openSlug} onStep={arriveByMist} />
                  )}
                  {spell === "detect" && <DetectMagic tags={tags} openSlug={openSlug} />}
                  {spell === "scry" && (
                    <Scrying note={openSlug ? openNote : undefined} openSlug={openSlug} />
                  )}
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
            </div>
          </section>
          <div ref={page} className="gh-tome-page gh-tome-right relative flex min-w-0 flex-col">
            <div
              ref={scroller}
              className="gh-tome-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-12 pb-12 md:px-12"
            >
              {children}
            </div>
            <div ref={layer} className="gh-tome-turn" aria-hidden="true" inert />
          </div>
        </div>
        <span className="gh-tome-clasp max-md:hidden" aria-hidden="true" />
      </div>
      <nav aria-label="Tome" className="gh-tome-dock fixed inset-x-0 bottom-0 z-40 flex md:hidden">
        <DockButton
          pressed={sheetOpen && !spell}
          name="Contents"
          plain={chapter?.name ?? ""}
          onClick={() => {
            setSpell(null);
            setSheetOpen(!(sheetOpen && !spell));
          }}
        />
        {SPELLS.map((s) => (
          <DockButton
            key={s.id}
            pressed={sheetOpen && spell === s.id}
            name={s.short}
            plain={s.plain}
            onClick={() => {
              if (sheetOpen && spell === s.id) return setSheetOpen(false);
              setSpell(s.id);
              setSheetOpen(true);
            }}
          />
        ))}
      </nav>
    </div>
  );
}

function DockButton({
  pressed,
  name,
  plain,
  onClick,
}: {
  pressed: boolean;
  name: string;
  plain: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex min-w-0 flex-1 flex-col items-center rounded-md px-1 py-2"
    >
      <span className="font-display max-w-full truncate text-sm leading-tight">{name}</span>
      <span className="max-w-full truncate text-[0.62rem] tracking-wider uppercase opacity-75">
        {plain}
      </span>
    </button>
  );
}

/** The chapter's notes, with its folders as sections. */
function Contents({ chapter }: { chapter: Chapter }) {
  const count = notesIn(chapter.folder).length;
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
                end
                className="gh-tome-entry font-prose flex items-baseline justify-between gap-3 px-1 py-1.5 text-lg"
              >
                <span className="gh-tome-title min-w-0 truncate">{note.title}</span>
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

/**
 * The book fills the window below the top bar and keeps that size from note to note, so the
 * page turn never resizes it: long notes scroll inside their page. The top bar's height varies
 * (it wraps, and the DM's preview adds a line), so it's measured.
 */
function useBookHeight(desk: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = desk.current;
    if (!element) return;
    const measure = () =>
      element.style.setProperty(
        "--tome-top",
        `${element.getBoundingClientRect().top + window.scrollY}px`,
      );
    measure();
    const header = document.querySelector("body > header");
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [desk]);
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
