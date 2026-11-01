import { describe, expect, it } from "vitest";
import { STARTING_CARDS } from "./actions";
import type { Board, BoardCard } from "./types";
import { boardForViewer, type BoardLookups } from "./view";

const lookups: BoardLookups = {
  // Fixture: players may read "open" but not "secret-note".
  note: (id) => (id === "open" ? { title: "Fixture Note", url: "/wiki/Fixture" } : undefined),
  playerName: (id) => `Player ${id}`,
};
const dmLookups: BoardLookups = { ...lookups, note: (id) => ({ title: id, url: `/wiki/${id}` }) };

const pin = (id: string, noteId: string, shown: boolean): BoardCard => ({
  id,
  kind: "note",
  noteId,
  shown,
  by: { dm: true },
  x: 0.5,
  y: 0.5,
});

const board: Board = {
  cards: [
    ...STARTING_CARDS,
    pin("shown", "open", true),
    pin("hidden", "open", false),
    pin("unreadable", "secret-note", true),
    {
      id: "card",
      kind: "text",
      text: "Fixture",
      shown: true,
      by: { dm: false, player: "one" },
      x: 0,
      y: 0,
    },
  ],
  strings: [
    { id: "seen", from: "shown", to: "card", by: { dm: true } },
    { id: "unseen", from: "hidden", to: "card", by: { dm: false, player: "one" } },
  ],
};

describe("boardForViewer", () => {
  it("shows players only shown cards whose notes they may read, and string between those", () => {
    const view = boardForViewer(board, { dm: false, player: "two" }, lookups);
    expect(view.cards.map((card) => card.id)).toEqual(["next", "sessions", "shown", "card"]);
    expect(view.strings.map((string) => string.id)).toEqual(["seen"]);
    expect(view.strings[0]).toMatchObject({ dm: true, mine: false });
  });

  it("says who wrote a card by their name, and which cards are the viewer's", () => {
    const view = boardForViewer(board, { dm: false, player: "one" }, lookups);
    expect(view.cards.find((card) => card.id === "card")).toMatchObject({
      by: { dm: false, name: "Player one" },
      mine: true,
    });
    expect(view.cards.find((card) => card.id === "shown")).toMatchObject({ mine: false });
  });

  it("shows the DM everything, all of it theirs to change", () => {
    const view = boardForViewer(board, { dm: true }, dmLookups);
    expect(view.cards).toHaveLength(6);
    expect(view.cards.every((card) => card.mine)).toBe(true);
    expect(view.strings).toHaveLength(2);
  });

  it("lets a player without a character look, but change nothing", () => {
    const view = boardForViewer(board, undefined, lookups);
    expect(view.cards.some((card) => card.mine)).toBe(false);
  });
});
