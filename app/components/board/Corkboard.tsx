import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import {
  BOARD_ASPECT,
  cardWidth,
  clampToBoard,
  pinOf,
  stringMiddle,
  stringPath,
  tiltOf,
} from "~/board/layout";
import type { BoardAuthor, BoardCard, BoardPage, BoardString } from "~/board/types";
import { NextSession } from "~/components/home/NextSession";
import { NotePicker } from "~/components/maps/NotePicker";
import { buttonClass, inputClass, primaryButtonClass } from "~/components/styles";
import { newId } from "~/shared/ids";
import { noteUrl } from "~/wiki/urls";

// Prototype: everything here lives in this tab until the board is stored.

/** Short cards stay short. */
const MOST_OF_A_CARD = 140;

type Tool = "none" | "pin" | "write" | "tie";

/**
 * The notice board as a corkboard: cards dragged anywhere, the DM's pinned notes, everyone's short
 * cards, and string between them. Phones get the same as a list.
 */
export function Corkboard({
  board,
  forDm,
  you,
}: {
  board: BoardPage;
  forDm: boolean;
  you: string;
}) {
  const me: BoardAuthor = forDm ? { dm: true } : { dm: false, name: you };
  const [cards, setCards] = useState<BoardCard[]>(() => [
    { id: "next", kind: "next", x: 0.03, y: 0.05 },
    { id: "sessions", kind: "sessions", x: 0.04, y: 0.42 },
  ]);
  const [strings, setStrings] = useState<BoardString[]>([]);
  const [tool, setTool] = useState<Tool>("none");
  const [tyingFrom, setTyingFrom] = useState<string>();
  const [label, setLabel] = useState("");
  const surface = useRef<HTMLDivElement>(null);

  const byId = new Map(cards.map((card) => [card.id, card]));
  const mine = (by: BoardAuthor) => forDm || (!by.dm && by.name === you);

  function place(id: string, at: { x: number; y: number }) {
    setCards((all) =>
      all.map((card) =>
        card.id === id ? { ...card, ...clampToBoard(at, cardWidth(card)) } : card,
      ),
    );
  }

  function add(card: BoardCard) {
    setCards((all) => [...all, card]);
    setTool("none");
  }

  function remove(id: string) {
    setCards((all) => all.filter((card) => card.id !== id));
    setStrings((all) => all.filter((string) => string.from !== id && string.to !== id));
  }

  function pick(id: string) {
    if (!tyingFrom) return setTyingFrom(id);
    if (tyingFrom !== id) {
      setStrings((all) => [
        ...all,
        {
          id: newId(),
          from: tyingFrom,
          to: id,
          by: me,
          ...(label.trim() && { label: label.trim() }),
        },
      ]);
    }
    setTyingFrom(undefined);
    setLabel("");
  }

  function choose(next: Tool) {
    setTool((current) => (current === next ? "none" : next));
    setTyingFrom(undefined);
  }

  /** Somewhere free-ish for a new card: across the middle of the board, a step on each time. */
  const fresh = () => {
    const step = cards.length - 2;
    return { x: 0.35 + (step % 3) * 0.2, y: 0.12 + (Math.floor(step / 3) % 4) * 0.2 };
  };

  function content(card: BoardCard): ReactNode {
    switch (card.kind) {
      case "next":
        return <NextSession at={board.nextSession} forDm={forDm} />;
      case "sessions":
        return <SessionsCard sessions={board.sessions} />;
      case "note": {
        const note = board.notes.find((each) => each.id === card.noteId);
        return (
          <>
            {note ? (
              <Link
                to={noteUrl(note.slug)}
                className="font-display text-lg text-link hover:underline"
              >
                {note.title}
              </Link>
            ) : (
              <span className="text-muted">A note that's gone</span>
            )}
            {card.caption && <p className="mt-1 text-sm">{card.caption}</p>}
          </>
        );
      }
      case "text":
        return (
          <>
            <p className="font-display text-base">{card.text}</p>
            <p className="mt-1 text-xs text-muted">— {card.by.dm ? "the DM" : card.by.name}</p>
          </>
        );
    }
  }

  return (
    <div className="mt-4">
      <div role="toolbar" aria-label="Board tools" className="flex flex-wrap items-center gap-2">
        {forDm && (
          <button
            type="button"
            className={buttonClass}
            aria-pressed={tool === "pin"}
            onClick={() => choose("pin")}
          >
            Pin a note
          </button>
        )}
        <button
          type="button"
          className={buttonClass}
          aria-pressed={tool === "write"}
          onClick={() => choose("write")}
        >
          Write a card
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-pressed={tool === "tie"}
          onClick={() => choose("tie")}
        >
          Tie string
        </button>
        <span className="text-sm text-muted">Prototype: nothing here is saved yet.</span>
      </div>

      {tool === "pin" && (
        <PinForm
          notes={board.notes}
          onPin={(noteId, caption) =>
            add({
              id: newId(),
              kind: "note",
              noteId,
              shown: false,
              by: me,
              ...fresh(),
              ...(caption && { caption }),
            })
          }
          onCancel={() => setTool("none")}
        />
      )}
      {tool === "write" && (
        <WriteForm
          onWrite={(text) =>
            add({ id: newId(), kind: "text", text, shown: !forDm, by: me, ...fresh() })
          }
          onCancel={() => setTool("none")}
        />
      )}
      {tool === "tie" && (
        <div className="gh-panel mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Label (optional)</span>
            <input
              className={inputClass}
              value={label}
              maxLength={40}
              placeholder="owes money to"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <p className="text-sm text-muted" role="status">
            {tyingFrom
              ? `Now pick the card to tie ${titleOf(byId.get(tyingFrom), board)} to.`
              : "Pick a card, then another. Click a string to cut it."}
          </p>
        </div>
      )}

      {/* The board itself, from tablets up. */}
      <div
        ref={surface}
        className="gh-board relative mt-4 hidden w-full overflow-hidden rounded-xl border border-line select-none md:block"
        style={{ aspectRatio: BOARD_ASPECT }}
      >
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            surface={surface}
            tying={tool === "tie"}
            picked={tyingFrom === card.id}
            onPick={() => pick(card.id)}
            onMove={(at) => place(card.id, at)}
            label={titleOf(card, board)}
            tools={
              "by" in card &&
              mine(card.by) && (
                <>
                  {card.by.dm && (
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() =>
                        setCards((all) =>
                          all.map((each) =>
                            each.id === card.id && "shown" in each
                              ? { ...each, shown: !each.shown }
                              : each,
                          ),
                        )
                      }
                    >
                      {card.shown ? "Hide from players" : "Show players"}
                    </button>
                  )}
                  <button type="button" className="hover:underline" onClick={() => remove(card.id)}>
                    Take down
                  </button>
                </>
              )
            }
          >
            {content(card)}
          </Card>
        ))}
        <svg
          viewBox={`0 0 1000 ${1000 / BOARD_ASPECT}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {strings.map((string) => {
            const [from, to] = [byId.get(string.from), byId.get(string.to)];
            if (!from || !to) return null;
            const path = stringPath(pinOf(from), pinOf(to));
            const cut = tool === "tie" && mine(string.by);
            return (
              <g key={string.id}>
                <path d={path} className={string.by.dm ? "gh-string-dm" : "gh-string-party"} />
                {cut && (
                  <path
                    d={path}
                    className="pointer-events-auto cursor-pointer stroke-transparent"
                    strokeWidth={14}
                    fill="none"
                    onClick={() => setStrings((all) => all.filter((each) => each.id !== string.id))}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {strings.map((string) => {
          const [from, to] = [byId.get(string.from), byId.get(string.to)];
          if (!from || !to || !string.label) return null;
          const middle = stringMiddle(pinOf(from), pinOf(to));
          return (
            <span
              key={string.id}
              className="gh-string-label pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 text-xs"
              style={{ left: `${middle.x * 100}%`, top: `${middle.y * 100}%` }}
            >
              {string.label}
            </span>
          );
        })}
      </div>

      {/* Phones: the same cards as a list, with what each is tied to. */}
      <ul className="mt-4 grid gap-3 md:hidden">
        {cards.map((card) => (
          <li key={card.id} className="gh-card rounded-xl border border-line bg-surface p-3">
            {content(card)}
            {strings
              .filter((string) => string.from === card.id || string.to === card.id)
              .map((string) => (
                <p key={string.id} className="mt-1 text-xs text-muted">
                  Tied to{" "}
                  {titleOf(byId.get(string.from === card.id ? string.to : string.from), board)}
                  {string.label && ` (${string.label})`}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One card on the board: dragged by the pointer anywhere but its links and buttons, or moved by the arrow keys. */
function Card({
  card,
  surface,
  tying,
  picked,
  onPick,
  onMove,
  label,
  tools,
  children,
}: {
  card: BoardCard;
  surface: React.RefObject<HTMLDivElement | null>;
  tying: boolean;
  picked: boolean;
  onPick: () => void;
  onMove: (at: { x: number; y: number }) => void;
  label: string;
  tools: ReactNode;
  children: ReactNode;
}) {
  const drag = useRef<{ dx: number; dy: number; moved: boolean }>(undefined);
  const hidden = "shown" in card && !card.shown;

  function down(event: PointerEvent<HTMLDivElement>) {
    if (tying || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("a, button, input, textarea, form")) return;
    const box = surface.current!.getBoundingClientRect();
    drag.current = {
      dx: (event.clientX - box.left) / box.width - card.x,
      dy: (event.clientY - box.top) / box.height - card.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const box = surface.current!.getBoundingClientRect();
    drag.current.moved = true;
    onMove({
      x: (event.clientX - box.left) / box.width - drag.current.dx,
      y: (event.clientY - box.top) / box.height - drag.current.dy,
    });
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (tying && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      return onPick();
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[event.key];
    if (!by) return;
    event.preventDefault();
    onMove({ x: card.x + by[0], y: card.y + by[1] });
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${label}${hidden ? " (DM only)" : ""}`}
      aria-pressed={tying ? picked : undefined}
      data-hidden={hidden || undefined}
      className={`gh-board-card absolute rounded-md border border-line bg-surface p-3 shadow-md ${tying ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
      style={{
        left: `${card.x * 100}%`,
        top: `${card.y * 100}%`,
        width: `${cardWidth(card) * 100}%`,
        rotate: `${tiltOf(card.id)}deg`,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => (drag.current = undefined)}
      // While tying string, a click anywhere on a card picks it, links and buttons included.
      onClickCapture={(event) => {
        if (!tying) return;
        event.preventDefault();
        event.stopPropagation();
        onPick();
      }}
      onKeyDown={key}
    >
      <span className="gh-board-pin" aria-hidden="true" />
      {hidden && <p className="mb-1 text-xs font-semibold text-dm uppercase">DM only</p>}
      {children}
      {tools && (
        <div className="gh-board-card-tools mt-2 flex gap-3 text-xs text-muted">{tools}</div>
      )}
    </div>
  );
}

function SessionsCard({ sessions }: { sessions: BoardPage["sessions"] }) {
  // On the board and in the phones' list both.
  const heading = useId();
  return (
    <section aria-labelledby={heading}>
      <h2 id={heading} className="font-display text-xl text-title">
        Sessions
      </h2>
      {sessions.length ? (
        <ul className="mt-1">
          {sessions.map((session) => (
            <li key={session.url}>
              <Link to={session.url} className="text-link hover:underline">
                {session.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted">No session notes yet.</p>
      )}
    </section>
  );
}

function PinForm({
  notes,
  onPin,
  onCancel,
}: {
  notes: BoardPage["notes"];
  onPin: (noteId: string, caption: string) => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [caption, setCaption] = useState("");
  const note = notes.find((each) => each.slug === slug);
  return (
    <form
      className="gh-panel mt-3 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (note) onPin(note.id, caption.trim());
      }}
    >
      <NotePicker label="Note" notes={notes} value={slug} onChange={setSlug} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Caption (optional)</span>
        <input
          className={inputClass}
          value={caption}
          maxLength={MOST_OF_A_CARD}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>
      <div className="flex items-end gap-2">
        <button className={primaryButtonClass} disabled={!note}>
          Pin it
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted sm:col-span-3">
        Pinned notes start DM only; show them to players when you're ready.
      </p>
    </form>
  );
}

function WriteForm({
  onWrite,
  onCancel,
}: {
  onWrite: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="gh-panel mt-3 grid gap-2 rounded-xl border border-line bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) onWrite(text.trim());
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Your card</span>
        <textarea
          className={inputClass}
          rows={2}
          value={text}
          maxLength={MOST_OF_A_CARD}
          placeholder="A sentence or two"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <button className={primaryButtonClass}>Pin it up</button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
        <span className="text-xs text-muted">
          {text.length} / {MOST_OF_A_CARD}
        </span>
      </div>
    </form>
  );
}

/** What a card is called, for its label and for string. */
function titleOf(card: BoardCard | undefined, board: BoardPage): string {
  switch (card?.kind) {
    case "next":
      return "Next session";
    case "sessions":
      return "Sessions";
    case "note":
      return board.notes.find((note) => note.id === card.noteId)?.title ?? "A note";
    case "text":
      return card.text.length > 30 ? `${card.text.slice(0, 30)}…` : card.text;
    default:
      return "a card";
  }
}
