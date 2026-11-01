import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, NavLink, useLocation, useNavigate, useRouteLoaderData } from "react-router";
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
import { CoverFront } from "./Cover";
import { copyOf, reducedMotion, scrollOf, usePageTurn } from "./usePageTurn";
import { useReading } from "./useReading";

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
  bookFolder,
  children,
}: {
  tree: FolderNode;
  tags: { tag: string; notes: NoteSummary[] }[];
  /** The vault folder that is the book, its folders the chapters; none for the whole vault. */
  bookFolder?: string;
  children: ReactNode;
}) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  // The wiki's front page is the closed book; it opens to its title page (`?open`).
  const closed = pathname === "/wiki" && search === "";
  const cover = useCover(closed);
  const front = useRouteLoaderData("routes/wiki-home") as
    { campaignName?: string; canName: boolean; bookFolder?: string; folders: string[] } | undefined;
  const chapters = useMemo(() => chaptersOf(tree, bookFolder), [tree, bookFolder]);
  const allNotes = useMemo(() => notesIn(tree), [tree]);
  // The book's order is the chapters' contents one after another, as the ribbons go.
  const order = useMemo(
    () => chapters.flatMap((chapter) => notesIn(chapter.folder).map((note) => note.slug)),
    [chapters],
  );
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
  const arriveByMist = usePageTurn(left, page, scroller, layer, order, closed);
  const closedNow = useRef(closed);
  useEffect(() => {
    closedNow.current = closed;
  }, [closed]);
  // The inside of the cover is the left page, so it lands as the page beneath it.
  const coverInside = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const inside = coverInside.current;
    if (!inside || !left.current || (cover.phase !== "opening" && cover.phase !== "closing"))
      return;
    const copy = copyOf(left.current);
    inside.replaceChildren(copy);
    const scroll = copy.querySelector<HTMLElement>(".gh-tome-scroll");
    if (scroll) scroll.scrollTop = scrollOf(left.current);
  }, [cover.phase]);
  const [reading, setReading] = useReading();
  const readingNow = useRef(reading);
  useEffect(() => {
    readingNow.current = reading;
  }, [reading]);

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
      setReading(false);
      // A spell cast at the cover opens the book.
      if (closedNow.current) navigate("/wiki?open");
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
      } else if (event.key.toLowerCase() === "r" && !isTyping(event.target)) {
        setReading(!readingNow.current);
      } else if (event.key === "Escape") {
        setReading(false);
        setSpell((casting) => {
          if (casting) requestAnimationFrame(() => spellButtons.current.get(casting)?.focus());
          return null;
        });
        setSheetOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setReading, navigate]);

  const chapter = chapters.find((c) => c.key === chapterKey) ?? chapters[0];

  function toggle(next: SpellId) {
    setReading(false);
    setSpell((casting) => (casting === next ? null : next));
    setSheetOpen(true);
  }

  function openChapter(key: string) {
    setReading(false);
    setChapterKey(key);
    setSpell(null);
    setSheetOpen(true);
  }

  return (
    <div ref={desk} className="gh-tome-desk px-4 pt-6 max-md:px-2 max-md:pt-3 xl:px-8">
      {/* As wide as the screen allows, to a point: big screens get a bigger book. */}
      <div
        data-cover={cover.phase === "open" ? undefined : cover.phase}
        className="gh-tome relative mx-auto max-w-[112rem]"
      >
        <div
          role="group"
          aria-label="Chapters"
          className="gh-tome-ribbons absolute -top-1 right-4 left-6 z-40 flex gap-1 overflow-x-auto [scrollbar-width:none] md:left-10"
        >
          {chapters.map((c, i) => (
            <button
              key={c.key}
              type="button"
              // Chapters outside the book's folder hang apart from its own.
              title={c.outside ? "Outside the book's folder" : undefined}
              data-outside={c.outside || undefined}
              data-apart={(c.outside && !chapters[i - 1]?.outside) || undefined}
              aria-pressed={!spell && c.key === chapter?.key}
              onClick={() => openChapter(c.key)}
              className="gh-tome-ribbon shrink-0 px-2.5 pt-2 pb-4 text-xs font-semibold tracking-wide"
            >
              {c.name}
            </button>
          ))}
        </div>
        <div
          data-reading={reading || undefined}
          inert={cover.phase === "shut" || undefined}
          className="gh-tome-spread relative grid h-full grid-rows-[minmax(0,1fr)]"
        >
          <section
            ref={left}
            aria-label="Spells and contents"
            data-open={sheetOpen || undefined}
            inert={reading || undefined}
            className="gh-tome-page gh-tome-left flex min-w-0 flex-col"
          >
            <div className="gh-tome-scroll @container min-h-0 flex-1 overflow-y-auto px-6 pt-12 pb-10 md:px-10">
              <p className="text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                The wiki · {allNotes.length} {allNotes.length === 1 ? "note" : "notes"}
              </p>
              <div
                role="group"
                aria-label="Spells"
                className="mt-2 grid grid-cols-2 gap-x-6 max-md:hidden @3xl:grid-cols-4"
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
            <div className="absolute top-3 right-4 z-20 flex gap-1 text-sm max-md:top-auto max-md:bottom-2">
              {/* Long reads: the left page folds away and the note has the book's width. */}
              <button
                type="button"
                aria-keyshortcuts="R"
                onClick={() => setReading(!reading)}
                className="gh-tome-read rounded px-2 py-0.5 max-md:hidden"
              >
                {reading ? "Contents" : "Read"}
              </button>
              <Link to="/wiki" className="gh-tome-read rounded px-2 py-0.5">
                Close
              </Link>
            </div>
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
        {cover.phase !== "open" && (
          <div className="gh-tome-cover" onAnimationEnd={cover.settle}>
            <CoverFront
              name={front?.campaignName}
              canName={front?.canName ?? false}
              bookFolder={front?.bookFolder}
              folders={front?.folders ?? []}
              onOpen={() => navigate("/wiki?open")}
            />
            <div ref={coverInside} className="gh-tome-cover-inside" aria-hidden="true" inert />
          </div>
        )}
      </div>
      <nav aria-label="Tome" className="gh-tome-dock fixed inset-x-0 bottom-0 z-40 flex md:hidden">
        <DockButton
          pressed={sheetOpen && !spell}
          name="Contents"
          plain={chapter?.name ?? ""}
          onClick={() => {
            setReading(false);
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
              setReading(false);
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
      {/* A wide page holds a long chapter's contents in two columns; a short one reads better in one. */}
      <div className={count > 12 ? "gh-tome-contents mt-2" : "mt-2"}>
        <FolderEntries folder={chapter.folder} />
      </div>
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

type CoverPhase = "shut" | "opening" | "closing" | "open";

/**
 * Where the cover is: shut on the wiki's front page, swinging open or closed as someone comes or
 * goes, or out of the way. With reduced motion it's simply shut or open.
 */
function useCover(closed: boolean) {
  const [phase, setPhase] = useState<CoverPhase>(closed ? "shut" : "open");
  const [wasClosed, setWasClosed] = useState(closed);
  if (closed !== wasClosed) {
    setWasClosed(closed);
    const still = typeof window === "undefined" || reducedMotion();
    setPhase(closed ? (still ? "shut" : "closing") : still ? "open" : "opening");
  }
  return {
    phase,
    /** The swing has ended: the cover is open or shut. */
    settle(event: { target: EventTarget; currentTarget: EventTarget }) {
      if (event.target !== event.currentTarget) return;
      setPhase((now) => (now === "opening" ? "open" : now === "closing" ? "shut" : now));
    },
  };
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
