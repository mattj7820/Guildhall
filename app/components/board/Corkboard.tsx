import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { MOST_OF_A_CARD, MOST_OF_A_LABEL } from "~/board/actions";
import {
  BOARD_ASPECT,
  cardWidth,
  clampToBoard,
  freeSpot,
  pinOf,
  stringMiddle,
  stringPath,
  tiltOf,
} from "~/board/layout";
import type { BoardPage, BoardPoint, CardView } from "~/board/types";
import { useBoard } from "~/board/useBoard";
import { NextSession } from "~/components/home/NextSession";
import { NotePicker } from "~/components/maps/NotePicker";
import { buttonClass, inputClass, primaryButtonClass } from "~/components/styles";
import { newId } from "~/shared/ids";

type Tool = "none" | "pin" | "write" | "tie";

/**
 * The notice board as a corkboard: cards dragged anywhere, the DM's pinned notes, everyone's short
 * cards, and string between them, saved and shared live. Phones get the same as a list.
 */
export function Corkboard({ page, forDm }: { page: BoardPage; forDm: boolean }) {
  const { board, error, send, drag, drop } = useBoard(page.board);
  const [tool, setTool] = useState<Tool>("none");
  const [tyingFrom, setTyingFrom] = useState<string>();
  const [label, setLabel] = useState("");
  const surface = useRef<HTMLDivElement>(null);

  const byId = new Map(board.cards.map((card) => [card.id, card]));

  async function put(action: Parameters<typeof send>[0]) {
    if (await send(action)) setTool("none");
  }

  function pick(id: string) {
    if (!tyingFrom) return setTyingFrom(id);
    if (tyingFrom !== id) {
      const text = label.trim();
      void send({
        type: "tie",
        id: newId(),
        from: tyingFrom,
        to: id,
        ...(text && { label: text }),
      });
    }
    setTyingFrom(undefined);
    setLabel("");
  }

  function choose(next: Tool) {
    setTool((current) => (current === next ? "none" : next));
    setTyingFrom(undefined);
  }

  function content(card: CardView): ReactNode {
    switch (card.kind) {
      case "next":
        return <NextSession at={page.nextSession} forDm={forDm} />;
      case "sessions":
        return <SessionsCard sessions={page.sessions} />;
      case "note":
        return (
          <>
            {card.note ? (
              <Link to={card.note.url} className="font-display text-lg text-link hover:underline">
                {card.note.title}
              </Link>
            ) : (
              <span className="text-muted">A note that&rsquo;s gone</span>
            )}
            {card.caption && <p className="mt-1 text-sm">{card.caption}</p>}
          </>
        );
      case "text":
        return (
          <>
            <p className="font-display text-base">{card.text}</p>
            <p className="mt-1 text-xs text-muted">— {card.by.dm ? "the DM" : card.by.name}</p>
          </>
        );
    }
  }

  function tools(card: CardView): ReactNode {
    if (!card.mine || (card.kind !== "note" && card.kind !== "text")) return null;
    return (
      <>
        {card.by.dm && (
          <button
            type="button"
            className="hover:underline"
            onClick={() => void send({ type: "show", id: card.id, shown: !card.shown })}
          >
            {card.shown ? "Hide from players" : "Show players"}
          </button>
        )}
        <button
          type="button"
          className="hover:underline"
          onClick={() => void send({ type: "takeDown", id: card.id })}
        >
          Take down
        </button>
      </>
    );
  }

  return (
    <div className="mt-4">
      {page.canWrite && (
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
            className={`${buttonClass} hidden md:inline-flex`}
            aria-pressed={tool === "tie"}
            onClick={() => choose("tie")}
          >
            Tie string
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {tool === "pin" && (
        <PinForm
          notes={page.notes}
          onPin={(noteId, caption) => {
            const id = newId();
            void put({
              type: "pin",
              id,
              noteId,
              at: freeSpot(board.cards, id),
              ...(caption && { caption }),
            });
          }}
          onCancel={() => setTool("none")}
        />
      )}
      {tool === "write" && (
        <WriteForm
          forDm={forDm}
          onWrite={(text) => {
            const id = newId();
            void put({ type: "write", id, text, at: freeSpot(board.cards, id) });
          }}
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
              maxLength={MOST_OF_A_LABEL}
              placeholder="owes money to"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <p className="text-sm text-muted" role="status">
            {tyingFrom
              ? `Now pick the card to tie ${titleOf(byId.get(tyingFrom))} to.`
              : "Pick a card, then another. Click your own string to cut it."}
          </p>
        </div>
      )}

      {/* The board itself, from tablets up. */}
      <div
        ref={surface}
        className="gh-board relative mt-4 hidden w-full overflow-hidden rounded-xl border border-line select-none md:block"
        style={{ aspectRatio: BOARD_ASPECT }}
      >
        {board.cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            surface={surface}
            tying={tool === "tie"}
            picked={tyingFrom === card.id}
            onPick={() => pick(card.id)}
            onDrag={(at) => drag(card.id, clampToBoard(at, cardWidth(card)))}
            onDrop={(at) => void drop(card.id, clampToBoard(at, cardWidth(card)))}
            label={titleOf(card)}
            tools={tools(card)}
          >
            {content(card)}
          </Card>
        ))}
        <svg
          viewBox={`0 0 1000 ${1000 / BOARD_ASPECT}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {board.strings.map((string) => {
            const [from, to] = [byId.get(string.from), byId.get(string.to)];
            if (!from || !to) return null;
            const path = stringPath(pinOf(from), pinOf(to));
            return (
              <g key={string.id}>
                <path d={path} className={string.dm ? "gh-string-dm" : "gh-string-party"} />
                {tool === "tie" && string.mine && (
                  <path
                    d={path}
                    className="pointer-events-auto cursor-pointer stroke-transparent"
                    strokeWidth={14}
                    fill="none"
                    onClick={() => void send({ type: "cut", id: string.id })}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {board.strings.map((string) => {
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
        {board.cards.map((card) => (
          <li key={card.id} className="gh-card rounded-xl border border-line bg-surface p-3">
            {"shown" in card && !card.shown && (
              <p className="mb-1 text-xs font-semibold text-dm uppercase">DM only</p>
            )}
            {content(card)}
            {board.strings
              .filter((string) => string.from === card.id || string.to === card.id)
              .map((string) => (
                <p key={string.id} className="mt-1 text-xs text-muted">
                  Tied to {titleOf(byId.get(string.from === card.id ? string.to : string.from))}
                  {string.label && ` (${string.label})`}
                </p>
              ))}
            {tools(card) && <div className="mt-2 flex gap-3 text-xs text-muted">{tools(card)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One card on the board: the viewer's own are dragged by the pointer anywhere but their links and
 * buttons, or moved by the arrow keys. While tying string, a click picks it.
 */
function Card({
  card,
  surface,
  tying,
  picked,
  onPick,
  onDrag,
  onDrop,
  label,
  tools,
  children,
}: {
  card: CardView;
  surface: React.RefObject<HTMLDivElement | null>;
  tying: boolean;
  picked: boolean;
  onPick: () => void;
  onDrag: (at: BoardPoint) => void;
  onDrop: (at: BoardPoint) => void;
  label: string;
  tools: ReactNode;
  children: ReactNode;
}) {
  const grip = useRef<{ dx: number; dy: number; at?: BoardPoint }>(undefined);
  const hidden = "shown" in card && !card.shown;
  const movable = card.mine && !tying;

  function where(event: PointerEvent<HTMLDivElement>): BoardPoint {
    const box = surface.current!.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / box.width - grip.current!.dx,
      y: (event.clientY - box.top) / box.height - grip.current!.dy,
    };
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (!movable || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("a, button, input, textarea, form")) return;
    const box = surface.current!.getBoundingClientRect();
    grip.current = {
      dx: (event.clientX - box.left) / box.width - card.x,
      dy: (event.clientY - box.top) / box.height - card.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!grip.current) return;
    grip.current.at = where(event);
    onDrag(grip.current.at);
  }

  function up() {
    const at = grip.current?.at;
    grip.current = undefined;
    if (at) onDrop(at);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (tying && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      return onPick();
    }
    if (!movable) return;
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
    onDrop({ x: card.x + by[0], y: card.y + by[1] });
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${label}${hidden ? " (DM only)" : ""}`}
      aria-pressed={tying ? picked : undefined}
      data-hidden={hidden || undefined}
      className={`gh-board-card absolute rounded-md border border-line bg-surface p-3 shadow-md ${tying ? "cursor-crosshair" : movable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        left: `${card.x * 100}%`,
        top: `${card.y * 100}%`,
        width: `${cardWidth(card) * 100}%`,
        rotate: `${tiltOf(card.id)}deg`,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
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
        Pinned notes start DM only; show them to players when you&rsquo;re ready.
      </p>
    </form>
  );
}

function WriteForm({
  forDm,
  onWrite,
  onCancel,
}: {
  forDm: boolean;
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
      <div className="flex flex-wrap items-center gap-2">
        <button className={primaryButtonClass}>Pin it up</button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
        <span className="text-xs text-muted">
          {text.length} / {MOST_OF_A_CARD}
          {forDm ? " · DM only until you show it" : " · the party sees it"}
        </span>
      </div>
    </form>
  );
}

/** What a card is called, for its label and for string. */
function titleOf(card: CardView | undefined): string {
  switch (card?.kind) {
    case "next":
      return "Next session";
    case "sessions":
      return "Sessions";
    case "note":
      return card.note?.title ?? "A note";
    case "text":
      return card.text.length > 30 ? `${card.text.slice(0, 30)}…` : card.text;
    default:
      return "a card";
  }
}
