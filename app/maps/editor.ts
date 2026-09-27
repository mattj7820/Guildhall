/**
 * The map editor's state and every change to it, as a pure reducer. The map itself (`doc`) goes
 * through an undo history and is what gets saved. The outline being drawn (`draft`) and the
 * selection are editing state only: a half-drawn area is never saved, and undoing a map change
 * doesn't undo a click on the canvas.
 */
import type { EntityId } from "~/campaign/types";
import { record, redo, startHistory, undo, type History } from "~/shared/history";
import { offset } from "./geometry";
import { OUTLINE_MAX, OUTLINE_MIN } from "./schema";
import type { Area, AreaId, MapChanges, MapId, Point } from "./types";

export type EditorDoc = MapChanges;

export interface EditorState {
  history: History<EditorDoc>;
  /** The outline being drawn, or null when not drawing. */
  draft: Point[] | null;
  selectedId?: AreaId;
}

export const NEW_AREA_NAME = "New area";

export type EditorAction =
  | { type: "startDrawing" }
  | { type: "addDraftPoint"; point: Point }
  | { type: "removeDraftPoint" }
  | { type: "cancelDrawing" }
  /** Closes the draft into a new area (the caller supplies its ID) and selects it. */
  | { type: "finishDrawing"; id: AreaId }
  | { type: "select"; id?: AreaId }
  | { type: "renameArea"; id: AreaId; name: string }
  | { type: "linkArea"; id: AreaId; map?: MapId; note?: EntityId }
  | { type: "deleteArea"; id: AreaId }
  | { type: "moveVertex"; id: AreaId; index: number; point: Point }
  /** Moves a vertex by a small offset; repeated nudges of the same point merge into one undo. */
  | { type: "nudgeVertex"; id: AreaId; index: number; dx: number; dy: number }
  /** Adds a point in the middle of the edge that starts at `index`. */
  | { type: "insertVertex"; id: AreaId; index: number; point: Point }
  | { type: "removeVertex"; id: AreaId; index: number }
  | { type: "editMap"; name?: string; note?: EntityId | null }
  | { type: "undo" }
  | { type: "redo" };

export function startEditor(doc: EditorDoc, selectedId?: AreaId): EditorState {
  const selectable = doc.areas.some((area) => area.id === selectedId);
  return {
    history: startHistory(doc),
    draft: null,
    selectedId: selectable ? selectedId : undefined,
  };
}

export function currentDoc(state: EditorState): EditorDoc {
  return state.history.present;
}

/** Whether the draft has enough points to become an area. */
export function canFinish(state: EditorState): boolean {
  return (state.draft?.length ?? 0) >= OUTLINE_MIN;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const doc = currentDoc(state);
  const change = (next: EditorDoc, mergeKey?: string): EditorState => ({
    ...state,
    history: record(state.history, next, mergeKey),
  });
  const changeArea = (id: AreaId, update: (area: Area) => Area | null, mergeKey?: string) => {
    const area = doc.areas.find((candidate) => candidate.id === id);
    const updated = area && update(area);
    if (!area || !updated || updated === area) return state;
    return change(
      { ...doc, areas: doc.areas.map((candidate) => (candidate.id === id ? updated : candidate)) },
      mergeKey,
    );
  };

  switch (action.type) {
    case "startDrawing":
      return { ...state, draft: [], selectedId: undefined };
    case "addDraftPoint":
      if (!state.draft || state.draft.length >= OUTLINE_MAX) return state;
      return { ...state, draft: [...state.draft, action.point] };
    case "removeDraftPoint":
      return state.draft ? { ...state, draft: state.draft.slice(0, -1) } : state;
    case "cancelDrawing":
      return { ...state, draft: null };
    case "finishDrawing": {
      if (!state.draft || !canFinish(state)) return state;
      const area: Area = {
        id: action.id,
        name: NEW_AREA_NAME,
        outline: state.draft,
        visibility: "dm",
      };
      return {
        ...change({ ...doc, areas: [...doc.areas, area] }),
        draft: null,
        selectedId: area.id,
      };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "renameArea":
      return changeArea(action.id, (area) => ({ ...area, name: action.name }), `name:${action.id}`);
    case "linkArea":
      return changeArea(action.id, (area) => {
        const linked: Area = { ...area };
        if ("map" in action) setOptional(linked, "map", action.map);
        if ("note" in action) setOptional(linked, "note", action.note);
        return linked;
      });
    case "deleteArea": {
      if (!doc.areas.some((area) => area.id === action.id)) return state;
      const next = change({ ...doc, areas: doc.areas.filter((area) => area.id !== action.id) });
      return { ...next, selectedId: state.selectedId === action.id ? undefined : state.selectedId };
    }
    case "moveVertex":
      return changeArea(action.id, (area) =>
        atVertex(area, action.index, (outline) => replaceAt(outline, action.index, action.point)),
      );
    case "nudgeVertex":
      return changeArea(
        action.id,
        (area) =>
          atVertex(area, action.index, (outline) =>
            replaceAt(outline, action.index, offset(outline[action.index], action.dx, action.dy)),
          ),
        `nudge:${action.id}:${action.index}`,
      );
    case "insertVertex":
      return changeArea(action.id, (area) =>
        area.outline.length >= OUTLINE_MAX
          ? null
          : atVertex(area, action.index, (outline) => [
              ...outline.slice(0, action.index + 1),
              action.point,
              ...outline.slice(action.index + 1),
            ]),
      );
    case "removeVertex":
      return changeArea(action.id, (area) =>
        area.outline.length <= OUTLINE_MIN
          ? null
          : atVertex(area, action.index, (outline) =>
              outline.filter((_, index) => index !== action.index),
            ),
      );
    case "editMap": {
      const next = { ...doc };
      if (action.name !== undefined) next.name = action.name;
      if (action.note !== undefined) setOptional(next, "note", action.note ?? undefined);
      return change(next, action.name !== undefined ? "map-name" : undefined);
    }
    case "undo":
      return withValidSelection({ ...state, history: undo(state.history) });
    case "redo":
      return withValidSelection({ ...state, history: redo(state.history) });
  }
}

/** Changes the outline only if `index` is one of its points, so a stale index can't corrupt it. */
function atVertex(area: Area, index: number, update: (outline: Point[]) => Point[]): Area | null {
  if (!Number.isInteger(index) || index < 0 || index >= area.outline.length) return null;
  return { ...area, outline: update(area.outline) };
}

function replaceAt(outline: Point[], index: number, point: Point): Point[] {
  return outline.map((existing, i) => (i === index ? point : existing));
}

/** Undo can remove the selected area; drop the selection rather than point at nothing. */
function withValidSelection(state: EditorState): EditorState {
  const { selectedId } = state;
  if (!selectedId || currentDoc(state).areas.some((area) => area.id === selectedId)) return state;
  return { ...state, selectedId: undefined };
}

/** Sets an optional field, or removes it entirely rather than storing `undefined`. */
function setOptional<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  if (value === undefined || value === "") delete target[key];
  else target[key] = value;
}
