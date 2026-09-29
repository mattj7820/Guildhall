import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Point } from "../types";
import { applyFogChange } from "./changes";
import { FogEditor } from "./editor";
import { encodeCells } from "./mask";
import { maskFrom, picture } from "./test-builders";
import type { FogChange, FogMask, FogView } from "./types";

const view = (mask: FogMask, version = 0): FogView => ({
  cols: mask.cols,
  rows: mask.rows,
  cells: encodeCells(mask.cells),
  version,
});

/**
 * A stand-in for the fog endpoint that applies changes like the real one, and can be told to fail
 * or to have the fog changed elsewhere first (another of the DM's tabs).
 */
function fakeServer(initial: FogMask) {
  let stored = initial;
  let version = 0;
  const server = {
    get stored() {
      return picture(stored);
    },
    posts: [] as FogChange[][],
    /** Answers the next posts with these instead of saving. */
    failWith: [] as (number | "offline")[],
    elsewhere(change: FogChange) {
      stored = applyFogChange(stored, change).mask;
      version++;
    },
    fetch: vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { changes } = JSON.parse(String(init?.body)) as { changes: FogChange[] };
      server.posts.push(changes);
      const failure = server.failWith.shift();
      if (failure === "offline") throw new TypeError("Failed to fetch");
      if (failure) return Response.json({ error: "Refused" }, { status: failure });
      for (const change of changes) stored = applyFogChange(stored, change).mask;
      return Response.json({ fog: view(stored, ++version) });
    }),
  };
  return server;
}

const TIMING = { saveDelayMs: 150, retryDelayMs: 3000 };
const EMPTY = ["....", "...."];

const columns = (from: number, to: number): Point[] => [
  [from, 0],
  [to, 0],
  [to, 1],
  [from, 1],
];
const reveal = (points: Point[]): FogChange => ({
  type: "paint",
  mode: "reveal",
  shape: { kind: "polygon", points },
});
const hide = (points: Point[]): FogChange => ({ ...reveal(points), mode: "hide" });
const LEFT = columns(0, 0.5);
const RIGHT = columns(0.5, 1);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setUp(rows = EMPTY) {
  const server = fakeServer(maskFrom(rows));
  const editor = new FogEditor(
    view(maskFrom(rows)),
    "/maps/m/fog",
    server.fetch as typeof fetch,
    TIMING,
  );
  const shown = () => picture(editor.getSnapshot().mask);
  return { server, editor, shown };
}

describe("FogEditor", () => {
  it("shows a reveal at once and saves it shortly after, with others as one batch", async () => {
    const { server, editor, shown } = setUp();
    editor.change(reveal(LEFT));
    editor.change(hide(columns(0, 0.25)));
    expect(shown()).toEqual([".#..", ".#.."]);
    expect(editor.getSnapshot()).toMatchObject({ unsaved: true, status: { kind: "saving" } });

    await vi.advanceTimersByTimeAsync(150);
    expect(server.posts).toEqual([[reveal(LEFT), hide(columns(0, 0.25))]]);
    expect(server.stored).toEqual([".#..", ".#.."]);
    expect(editor.getSnapshot()).toMatchObject({ unsaved: false, status: { kind: "saved" } });
  });

  it("undoes and redoes, saving each step", async () => {
    const { server, editor, shown } = setUp();
    editor.change(reveal(LEFT));
    editor.undo();
    expect(shown()).toEqual(EMPTY);
    expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });
    editor.redo();
    expect(shown()).toEqual(["##..", "##.."]);
    await vi.advanceTimersByTimeAsync(150);
    expect(server.stored).toEqual(["##..", "##.."]);
  });

  it("doesn't undo what was revealed elsewhere meanwhile", async () => {
    const { server, editor, shown } = setUp();
    editor.change(reveal(LEFT));
    await vi.advanceTimersByTimeAsync(150);
    server.elsewhere(reveal(RIGHT));
    editor.undo();
    await vi.advanceTimersByTimeAsync(150);
    expect(server.stored).toEqual(["..##", "..##"]);
    expect(shown()).toEqual(["..##", "..##"]);
  });

  it("picks up changes made elsewhere when its own are saved", async () => {
    const { server, editor, shown } = setUp();
    server.elsewhere(reveal(RIGHT));
    editor.change(reveal(columns(0, 0.25)));
    await vi.advanceTimersByTimeAsync(150);
    expect(shown()).toEqual(["#.##", "#.##"]);
  });

  it("keeps changes made while a save is on its way, and sends them next", async () => {
    const { server, editor, shown } = setUp();
    editor.change(reveal(columns(0, 0.25)));
    await vi.advanceTimersByTimeAsync(150);
    editor.change(reveal(RIGHT));
    expect(shown()).toEqual(["#.##", "#.##"]);
    await vi.advanceTimersByTimeAsync(150);
    expect(server.posts).toHaveLength(2);
    expect(server.stored).toEqual(["#.##", "#.##"]);
  });

  it("ignores a change that changes nothing: nothing to save or undo", async () => {
    const { server, editor } = setUp(["####", "####"]);
    editor.change(reveal(LEFT));
    expect(editor.getSnapshot()).toMatchObject({ canUndo: false, unsaved: false });
    await vi.advanceTimersByTimeAsync(150);
    expect(server.posts).toEqual([]);
  });

  it("starts a new change afresh, forgetting what was undone", () => {
    const { editor } = setUp();
    editor.change(reveal(LEFT));
    editor.undo();
    editor.change(reveal(RIGHT));
    expect(editor.getSnapshot().canRedo).toBe(false);
  });

  it("tries again, in order, when Guildhall can't be reached", async () => {
    const { server, editor, shown } = setUp();
    server.failWith.push("offline");
    editor.change(reveal(LEFT));
    await vi.advanceTimersByTimeAsync(150);
    expect(editor.getSnapshot().status).toMatchObject({ kind: "error", retrying: true });
    editor.change(hide(columns(0, 0.25)));
    expect(shown()).toEqual([".#..", ".#.."]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(server.posts.at(-1)).toEqual([reveal(LEFT), hide(columns(0, 0.25))]);
    expect(server.stored).toEqual([".#..", ".#.."]);
    expect(editor.getSnapshot().status).toEqual({ kind: "saved" });
  });

  it("lets go of changes the server refuses, and shows what it kept", async () => {
    const { server, editor, shown } = setUp();
    server.failWith.push(400);
    editor.change(reveal(LEFT));
    await vi.advanceTimersByTimeAsync(150);
    expect(editor.getSnapshot().status).toEqual({
      kind: "error",
      message: "Refused",
      retrying: false,
    });
    expect(shown()).toEqual(EMPTY);
  });

  it("saves at once when asked, e.g. on leaving the page", async () => {
    const { server, editor } = setUp();
    editor.change(reveal(LEFT));
    editor.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.posts).toHaveLength(1);
  });
});
