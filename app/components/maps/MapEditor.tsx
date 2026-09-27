import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link, useFetcher } from "react-router";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import {
  canFinish,
  currentDoc,
  editorReducer,
  startEditor,
  type EditorAction,
  type EditorDoc,
} from "~/maps/editor";
import { normalise, svgPoints } from "~/maps/geometry";
import type { TreeMap } from "~/maps/tree";
import type { Area, CampaignMap, MapView } from "~/maps/types";
import type { action } from "~/routes/map-edit";
import { newId } from "~/shared/ids";
import type { NoteSummary } from "~/wiki/types";
import { AreaForm } from "./AreaForm";
import { DraftOutline } from "./DraftOutline";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";

/** Wait this long after the last change before saving, so typing doesn't save every key. */
const AUTOSAVE_DELAY_MS = 500;

export interface MapEditorProps {
  map: CampaignMap;
  view: MapView;
  maps: TreeMap[];
  notes: Pick<NoteSummary, "id" | "slug" | "title">[];
  images: string[];
  selectedArea?: string;
  viewUrl: string;
}

/**
 * Draws and edits a map's areas. Every change goes through the pure `editorReducer` with undo, and
 * is saved to the server automatically; the status shows whether it has been.
 */
export function MapEditor(props: MapEditorProps) {
  const { map, view, viewUrl } = props;
  const [state, dispatch] = useReducer(
    editorReducer,
    { name: map.name, note: map.note, image: map.image, areas: map.areas },
    (doc: EditorDoc) => startEditor(doc, props.selectedArea),
  );
  const doc = currentDoc(state);
  const drawing = state.draft !== null;
  const selected = doc.areas.find((area) => area.id === state.selectedId);
  const { status, error, saveNow } = useAutosave(doc);
  const [pointer, setPointer] = useState<[number, number]>();

  const finish = () => dispatch({ type: "finishDrawing", id: newId() });

  // Undo and redo work anywhere on the page except while typing, where the field's own undo wins.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onCanvasKey(event: React.KeyboardEvent) {
    const keys: Record<string, EditorAction | (() => void) | undefined> = drawing
      ? {
          Enter: finish,
          Backspace: { type: "removeDraftPoint" },
          Escape: { type: "cancelDrawing" },
        }
      : { d: { type: "startDrawing" }, Escape: { type: "select" } };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    if (typeof handler === "function") handler();
    else dispatch(handler);
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <MapBreadcrumbs crumbs={view.breadcrumbs} suffix=" · editing" />
        <h1 className="sr-only">Editing {doc.name}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="text-sm text-stone-500">
            {status && (status === "All changes saved" ? `✓ ${status}` : status)}
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={state.history.past.length === 0}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={state.history.future.length === 0}
            onClick={() => dispatch({ type: "redo" })}
          >
            Redo
          </button>
          <Link to={viewUrl} onClick={saveNow} className={primaryButtonClass}>
            Done
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="bg-rose-100 px-4 py-2 text-sm text-rose-900">
          Couldn't save: {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative flex min-h-[50vh] flex-1 flex-col">
          <DrawingToolbar
            drawing={drawing}
            canFinish={canFinish(state)}
            dispatch={dispatch}
            onFinish={finish}
          />
          <MapCanvas
            name={doc.name}
            size={view.size}
            imageUrl={view.image.url}
            className={`flex-1 ${drawing ? "[&_[role=region]]:cursor-crosshair" : ""}`}
            onKeyDown={onCanvasKey}
            onCanvasClick={([x, y]) => {
              if (drawing) dispatch({ type: "addDraftPoint", point: normalise(x, y, view.size) });
              else dispatch({ type: "select" });
            }}
            onCanvasPointerMove={drawing ? setPointer : undefined}
          >
            {(scale) => (
              <>
                {doc.areas.map((area) => (
                  <EditableArea
                    key={area.id}
                    area={area}
                    view={view}
                    selected={area.id === state.selectedId}
                    // While drawing, clicks inside an area place points instead.
                    onSelect={drawing ? undefined : () => dispatch({ type: "select", id: area.id })}
                  />
                ))}
                {state.draft && (
                  <DraftOutline
                    points={state.draft}
                    pointer={pointer}
                    size={view.size}
                    scale={scale}
                    canFinish={canFinish(state)}
                    onFinish={finish}
                  />
                )}
              </>
            )}
          </MapCanvas>
        </div>

        <aside
          aria-label="Editing"
          className="flex w-full flex-col gap-5 overflow-y-auto border-stone-200 p-4 md:w-96 md:border-l dark:border-stone-800"
        >
          {selected && (
            <AreaForm key={selected.id} area={selected} dispatch={dispatch} onBlur={saveNow} />
          )}
          <EditorAreaList
            areas={doc.areas}
            selectedId={state.selectedId}
            onSelect={(id) => dispatch({ type: "select", id })}
          />
        </aside>
      </div>
    </main>
  );
}

function DrawingToolbar({
  drawing,
  canFinish,
  dispatch,
  onFinish,
}: {
  drawing: boolean;
  canFinish: boolean;
  dispatch: (action: EditorAction) => void;
  onFinish: () => void;
}) {
  return (
    <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md bg-white/90 p-2 text-sm shadow dark:bg-stone-900/90">
      {drawing ? (
        <>
          <p className="basis-full text-stone-600 dark:text-stone-300">
            Click the map to place points. Enter or the first point finishes, Backspace removes the
            last point, Esc cancels.
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!canFinish}
            onClick={onFinish}
          >
            Finish area
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => dispatch({ type: "removeDraftPoint" })}
          >
            Remove last point
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => dispatch({ type: "cancelDrawing" })}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => dispatch({ type: "startDrawing" })}
        >
          Draw area
        </button>
      )}
    </div>
  );
}

/** An area on the editing canvas; the side panel's list is the accessible way to select one. */
function EditableArea({
  area,
  view,
  selected,
  onSelect,
}: {
  area: Area;
  view: MapView;
  selected: boolean;
  onSelect?: () => void;
}) {
  return (
    <polygon
      aria-hidden="true"
      points={svgPoints(area.outline, view.size)}
      vectorEffect="non-scaling-stroke"
      strokeWidth={selected ? 3 : 2}
      strokeDasharray={area.map ? undefined : "6 4"}
      className={
        selected
          ? "fill-sky-400/30 stroke-sky-700"
          : `${onSelect ? "cursor-pointer hover:fill-amber-400/40" : ""} fill-amber-400/15 stroke-amber-700 dark:stroke-amber-400`
      }
      onClick={
        onSelect &&
        ((event) => {
          event.stopPropagation();
          onSelect();
        })
      }
    />
  );
}

function EditorAreaList({
  areas,
  selectedId,
  onSelect,
}: {
  areas: Area[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="editor-areas-heading">
      <h2
        id="editor-areas-heading"
        className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase"
      >
        Areas ({areas.length})
      </h2>
      {areas.length === 0 ? (
        <p className="text-sm text-stone-500">
          None yet. Press Draw area, then click round something on the map.
        </p>
      ) : (
        <ul aria-label="Areas" className="flex flex-col text-sm">
          {areas.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                aria-pressed={area.id === selectedId}
                onClick={() => onSelect(area.id)}
                className="block w-full rounded px-1 py-0.5 text-left hover:bg-stone-100 aria-pressed:bg-sky-100 aria-pressed:font-semibold dark:hover:bg-stone-800 dark:aria-pressed:bg-sky-950"
              >
                {area.map ? "▸" : "◌"} {area.name || "Unnamed area"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Saves the map shortly after each change. Keeps the last snapshot sent, so nothing is sent twice
 * and the status can say whether everything has reached the server.
 */
function useAutosave(doc: EditorDoc) {
  const fetcher = useFetcher<typeof action>();
  // Memoised on the document, so pointer moves and drags don't re-serialise the map every frame.
  const snapshot = useMemo(() => JSON.stringify({ intent: "save", ...doc }), [doc]);
  const [submitted, setSubmitted] = useState(snapshot);
  const dirty = snapshot !== submitted;

  const { submit } = fetcher;
  const save = useCallback(() => {
    void submit(JSON.parse(snapshot), { method: "post", encType: "application/json" });
    setSubmitted(snapshot);
  }, [submit, snapshot]);
  const saveNow = () => {
    if (dirty) save();
  };

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, save]);

  // Closing the tab mid-save is the one way to lose a change, so the browser asks first.
  useEffect(() => {
    if (!dirty && fetcher.state === "idle") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, fetcher.state]);

  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : undefined;
  const status = error
    ? undefined
    : dirty || fetcher.state !== "idle"
      ? "Saving…"
      : "All changes saved";
  return { status, error, saveNow };
}
