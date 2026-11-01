import { describe, expect, it } from "vitest";
import { applyBoardAction, STARTING_CARDS, withFixedCards, type BoardAction } from "./actions";
import type { Board, BoardAuthor, BoardCard } from "./types";

const DM: BoardAuthor = { dm: true };
const ONE: BoardAuthor = { dm: false, player: "one" };
const TWO: BoardAuthor = { dm: false, player: "two" };
const at = { x: 0.5, y: 0.5 };

const note = (id: string, shown = true): BoardCard => ({
  id,
  kind: "note",
  noteId: `note-${id}`,
  shown,
  by: DM,
  x: 0.5,
  y: 0.5,
});
const text = (id: string, by: BoardAuthor): BoardCard => ({
  id,
  kind: "text",
  text: "Fixture",
  shown: true,
  by,
  x: 0.5,
  y: 0.5,
});

const board: Board = {
  cards: [...STARTING_CARDS, note("pinned"), note("secret", false), text("ones", ONE)],
  strings: [{ id: "string", from: "pinned", to: "ones", by: ONE }],
};
// As players see it: the DM-only card is out of sight.
const playersSee = (card: BoardCard) => card.id !== "secret";
const all = () => true;

function apply(action: BoardAction, actor: BoardAuthor) {
  return applyBoardAction(board, action, actor, actor.dm ? all : playersSee);
}

describe("applyBoardAction", () => {
  it("lets players move their own cards, never others' or the fixed ones", () => {
    expect(apply({ type: "place", id: "ones", at }, ONE)).toBeDefined();
    expect(apply({ type: "place", id: "ones", at }, TWO)).toBeUndefined();
    expect(apply({ type: "place", id: "pinned", at }, ONE)).toBeUndefined();
    expect(apply({ type: "place", id: "next", at }, ONE)).toBeUndefined();
    expect(apply({ type: "place", id: "next", at }, DM)).toBeDefined();
  });

  it("keeps a moved card on the board", () => {
    const moved = apply({ type: "place", id: "ones", at: { x: 1, y: 1 } }, ONE)!;
    expect(moved.cards.find((card) => card.id === "ones")).toMatchObject({ x: 0.83, y: 0.92 });
  });

  it("pins notes for the DM only, DM only to start", () => {
    const pin: BoardAction = { type: "pin", id: "new", noteId: "n", caption: " Fixture ", at };
    expect(apply(pin, ONE)).toBeUndefined();
    expect(apply(pin, DM)!.cards.at(-1)).toMatchObject({ shown: false, caption: "Fixture" });
  });

  it("shows a player's card at once, and keeps the DM's for the DM until shown", () => {
    const write = (by: BoardAuthor) =>
      apply({ type: "write", id: "new", text: "  Fixture card  ", at }, by)!.cards.at(-1);
    expect(write(ONE)).toMatchObject({ text: "Fixture card", shown: true, by: ONE });
    expect(write(DM)).toMatchObject({ shown: false, by: DM });
  });

  it("refuses an empty card, or an ID already used", () => {
    expect(apply({ type: "write", id: "new", text: "   ", at }, ONE)).toBeUndefined();
    expect(apply({ type: "write", id: "pinned", text: "Fixture", at }, ONE)).toBeUndefined();
  });

  it("lets only the DM show or hide their own cards", () => {
    expect(apply({ type: "show", id: "secret", shown: true }, DM)).toBeDefined();
    expect(apply({ type: "show", id: "ones", shown: false }, DM)).toBeUndefined();
    expect(apply({ type: "show", id: "pinned", shown: false }, ONE)).toBeUndefined();
  });

  it("takes down a card with its string, but never a fixed card", () => {
    const after = apply({ type: "takeDown", id: "ones" }, ONE)!;
    expect(after.cards.map((card) => card.id)).not.toContain("ones");
    expect(after.strings).toEqual([]);
    expect(apply({ type: "takeDown", id: "ones" }, TWO)).toBeUndefined();
    expect(apply({ type: "takeDown", id: "sessions" }, DM)).toBeUndefined();
  });

  it("ties string between two cards the actor sees, and never to a hidden one", () => {
    const tie = (to: string): BoardAction => ({
      type: "tie",
      id: "new",
      from: "ones",
      to,
      label: "Fixture",
    });
    expect(apply(tie("pinned"), TWO)!.strings.at(-1)).toMatchObject({ by: TWO, label: "Fixture" });
    expect(apply(tie("secret"), TWO)).toBeUndefined();
    expect(apply(tie("ones"), TWO)).toBeUndefined();
    expect(apply(tie("missing"), TWO)).toBeUndefined();
  });

  it("cuts only one's own string, or any for the DM", () => {
    expect(apply({ type: "cut", id: "string" }, TWO)).toBeUndefined();
    expect(apply({ type: "cut", id: "string" }, ONE)!.strings).toEqual([]);
    expect(apply({ type: "cut", id: "string" }, DM)!.strings).toEqual([]);
  });
});

describe("withFixedCards", () => {
  it("puts the fixed cards on a board without them, and leaves them where they are", () => {
    expect(withFixedCards({ cards: [], strings: [] }).cards).toEqual(STARTING_CARDS);
    const moved = { ...STARTING_CARDS[0], x: 0.6 };
    const board = withFixedCards({ cards: [moved], strings: [] });
    expect(board.cards).toContainEqual(moved);
    expect(board.cards).toHaveLength(2);
  });
});
