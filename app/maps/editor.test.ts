import { describe, expect, it } from "vitest";
import {
  canFinish,
  currentDoc,
  editorReducer,
  NEW_AREA_NAME,
  startEditor,
  type EditorAction,
  type EditorDoc,
  type EditorState,
} from "./editor";
import { OUTLINE_MIN } from "./schema";
import { buildArea, SQUARE } from "./test-builders";
import type { Point } from "./types";

const doc = (fields: Partial<EditorDoc> = {}): EditorDoc => ({
  name: "World",
  areas: [],
  ...fields,
});

const run = (state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce(editorReducer, state);

const TRIANGLE: Point[] = [
  [0.1, 0.1],
  [0.5, 0.1],
  [0.3, 0.4],
];
const draw = (...points: Point[]): EditorAction[] => [
  { type: "startDrawing" },
  ...points.map((point): EditorAction => ({ type: "addDraftPoint", point })),
];

const withSquare = () => startEditor(doc({ areas: [buildArea({ id: "a", name: "Mill" })] }));
const areaA = (state: EditorState) => currentDoc(state).areas.find((area) => area.id === "a");

describe("drawing an area", () => {
  it("places points, then closes them into a new, selected area", () => {
    const drawing = run(startEditor(doc()), ...draw(...TRIANGLE));
    expect(drawing.draft).toEqual(TRIANGLE);
    expect(currentDoc(drawing).areas).toEqual([]);

    const done = editorReducer(drawing, { type: "finishDrawing", id: "new" });
    expect(currentDoc(done).areas).toEqual([
      { id: "new", name: NEW_AREA_NAME, outline: TRIANGLE, visibility: "players" },
    ]);
    expect(done.draft).toBeNull();
    expect(done.selectedId).toBe("new");
  });

  it(`needs at least ${OUTLINE_MIN} points`, () => {
    const drawing = run(startEditor(doc()), ...draw(TRIANGLE[0], TRIANGLE[1]));
    expect(canFinish(drawing)).toBe(false);
    expect(editorReducer(drawing, { type: "finishDrawing", id: "new" })).toBe(drawing);
  });

  it("takes back the last point", () => {
    const drawing = run(startEditor(doc()), ...draw(...TRIANGLE), { type: "removeDraftPoint" });
    expect(drawing.draft).toEqual(TRIANGLE.slice(0, 2));
  });

  it("cancels without changing the map", () => {
    const start = startEditor(doc());
    const cancelled = run(start, ...draw(...TRIANGLE), { type: "cancelDrawing" });
    expect(cancelled.draft).toBeNull();
    expect(cancelled.history).toBe(start.history);
  });

  it("ignores points when not drawing", () => {
    const start = startEditor(doc());
    expect(editorReducer(start, { type: "addDraftPoint", point: [0.5, 0.5] })).toBe(start);
  });

  it("undoes a finished area in one step", () => {
    const done = run(startEditor(doc()), ...draw(...TRIANGLE), { type: "finishDrawing", id: "n" });
    const undone = editorReducer(done, { type: "undo" });
    expect(currentDoc(undone).areas).toEqual([]);
    expect(undone.selectedId).toBeUndefined();
  });
});

describe("editing areas", () => {
  it("renames an area, and undoes the whole name at once", () => {
    let state = withSquare();
    for (const name of ["O", "Ol", "Old", "Old Mill"]) {
      state = editorReducer(state, { type: "renameArea", id: "a", name });
    }
    expect(areaA(state)?.name).toBe("Old Mill");
    expect(areaA(editorReducer(state, { type: "undo" }))?.name).toBe("Mill");
  });

  it("links an area to a map and a note, and unlinks them without leaving empty fields", () => {
    const linked = run(withSquare(), { type: "linkArea", id: "a", map: "town", note: "n" });
    expect(areaA(linked)).toMatchObject({ map: "town", note: "n" });

    const unlinked = run(linked, { type: "linkArea", id: "a", map: undefined });
    expect(areaA(unlinked)).not.toHaveProperty("map");
    expect(areaA(unlinked)).toMatchObject({ note: "n" });
  });

  it("makes an area secret from players, and undoes it", () => {
    const shown = startEditor(doc({ areas: [buildArea({ id: "a", visibility: "players" })] }));
    const secret = editorReducer(shown, { type: "setAreaSecret", id: "a", secret: true });
    expect(areaA(secret)?.visibility).toBe("dm");
    expect(areaA(editorReducer(secret, { type: "undo" }))?.visibility).toBe("players");
    expect(editorReducer(secret, { type: "setAreaSecret", id: "a", secret: true })).toBe(secret);
  });

  it("deletes an area and clears the selection", () => {
    const state = run(withSquare(), { type: "select", id: "a" }, { type: "deleteArea", id: "a" });
    expect(currentDoc(state).areas).toEqual([]);
    expect(state.selectedId).toBeUndefined();
    expect(areaA(editorReducer(state, { type: "undo" }))?.name).toBe("Mill");
  });

  it("ignores changes to an area that isn't there", () => {
    const state = withSquare();
    expect(editorReducer(state, { type: "renameArea", id: "gone", name: "x" })).toBe(state);
    expect(editorReducer(state, { type: "deleteArea", id: "gone" })).toBe(state);
  });

  it("renames the map and changes its note", () => {
    const state = run(startEditor(doc({ note: "old" })), { type: "editMap", name: "The World" });
    expect(currentDoc(state)).toMatchObject({ name: "The World", note: "old" });
    const cleared = editorReducer(state, { type: "editMap", note: null });
    expect(currentDoc(cleared)).not.toHaveProperty("note");
  });

  it("redoes what was undone", () => {
    const renamed = run(withSquare(), { type: "renameArea", id: "a", name: "Keep" });
    const redone = run(renamed, { type: "undo" }, { type: "redo" });
    expect(areaA(redone)?.name).toBe("Keep");
  });
});

describe("the battle grid", () => {
  const grid = { square: 0.05, origin: [0, 0] as [number, number], lines: 0.35 };

  it("turns the grid on and off, each an undo step", () => {
    const on = run(startEditor(doc()), { type: "setGrid", grid });
    expect(currentDoc(on).grid).toEqual(grid);
    const off = editorReducer(on, { type: "setGrid", grid: null });
    expect(currentDoc(off)).not.toHaveProperty("grid");
    expect(currentDoc(editorReducer(off, { type: "undo" })).grid).toEqual(grid);
  });

  it("makes one undo step of dragging a grid setting", () => {
    const state = run(
      startEditor(doc({ grid })),
      { type: "setGrid", grid: { ...grid, square: 0.04 } },
      { type: "setGrid", grid: { ...grid, square: 0.03 } },
    );
    expect(currentDoc(editorReducer(state, { type: "undo" })).grid).toEqual(grid);
  });
});

describe("reshaping an area", () => {
  it("moves a point", () => {
    const state = editorReducer(withSquare(), {
      type: "moveVertex",
      id: "a",
      index: 2,
      point: [0.9, 0.9],
    });
    expect(areaA(state)?.outline[2]).toEqual([0.9, 0.9]);
  });

  it("nudges a point, merging repeated nudges into one undo step", () => {
    const nudge = { type: "nudgeVertex", id: "a", index: 0, dx: 0.01, dy: 0 } as const;
    const state = run(withSquare(), nudge, nudge, nudge);
    expect(areaA(state)?.outline[0]).toEqual([0.13, 0.1]);
    expect(areaA(editorReducer(state, { type: "undo" }))?.outline).toEqual(SQUARE);
  });

  it("keeps nudged points on the image", () => {
    const state = editorReducer(withSquare(), {
      type: "nudgeVertex",
      id: "a",
      index: 0,
      dx: -1,
      dy: -1,
    });
    expect(areaA(state)?.outline[0]).toEqual([0, 0]);
  });

  it("inserts a point after the given one", () => {
    const state = editorReducer(withSquare(), {
      type: "insertVertex",
      id: "a",
      index: 0,
      point: [0.2, 0.05],
    });
    expect(areaA(state)?.outline).toEqual([SQUARE[0], [0.2, 0.05], ...SQUARE.slice(1)]);
  });

  it("removes a point, but never below three", () => {
    const once = editorReducer(withSquare(), { type: "removeVertex", id: "a", index: 1 });
    expect(areaA(once)?.outline).toEqual([SQUARE[0], SQUARE[2], SQUARE[3]]);
    expect(editorReducer(once, { type: "removeVertex", id: "a", index: 0 })).toBe(once);
  });

  it.each([-1, 4, 1.5])("ignores a point index that isn't there: %s", (index) => {
    const state = withSquare();
    expect(editorReducer(state, { type: "moveVertex", id: "a", index, point: [0.5, 0.5] })).toBe(
      state,
    );
  });
});

describe("startEditor", () => {
  it("can open with an area selected, if it exists", () => {
    const map = doc({ areas: [buildArea({ id: "a" })] });
    expect(startEditor(map, "a").selectedId).toBe("a");
    expect(startEditor(map, "gone").selectedId).toBeUndefined();
  });
});
