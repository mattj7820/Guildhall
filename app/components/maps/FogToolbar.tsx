import { buttonClass, primaryButtonClass } from "~/components/styles";
import type { FogSaveStatus } from "~/maps/fog/editor";
import { BRUSH_MAX, BRUSH_MIN } from "~/maps/fog/schema";
import type { FogMode } from "~/maps/fog/types";
import type { FogTool } from "./FogPainter";

/** Brush sizes offered, as a share of the image's longer side. */
export const BRUSH_SIZES = { min: Math.max(BRUSH_MIN, 0.005), max: Math.min(BRUSH_MAX, 0.15) };

interface Props {
  tool: FogTool;
  onTool: (tool: FogTool) => void;
  /** What the tools do now, with Alt held or not. */
  mode: FogMode;
  onToggleMode: () => void;
  /** The brush's radius as a share of the image's longer side. */
  radius: number;
  onRadius: (radius: number) => void;
  onRevealAll: () => void;
  onHideAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  status: FogSaveStatus;
  /** The share of the map players can see, 0 to 1. */
  revealed: number;
}

const TOOLS: { tool: FogTool; label: string; key: string }[] = [
  { tool: "brush", label: "Brush", key: "B" },
  { tool: "area", label: "Area", key: "A" },
  { tool: "rectangle", label: "Rectangle", key: "R" },
];

/** The DM's fog tools, above the map. Keys: B, A, R, X (or hold Alt), [ and ], Ctrl+Z. */
export function FogToolbar(props: Props) {
  const { tool, mode, radius, status } = props;
  return (
    <div
      role="toolbar"
      aria-label="Fog of war"
      className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2 text-sm dark:border-stone-800 dark:bg-stone-900"
    >
      {TOOLS.map(({ tool: option, label, key }) => (
        <button
          key={option}
          type="button"
          aria-pressed={tool === option}
          aria-keyshortcuts={key}
          title={`${label} (${key})`}
          className={tool === option ? primaryButtonClass : buttonClass}
          onClick={() => props.onTool(option)}
        >
          {label}
        </button>
      ))}
      <span
        aria-hidden="true"
        className="mx-1 h-6 border-l border-stone-300 dark:border-stone-700"
      />
      <button
        type="button"
        role="switch"
        aria-checked={mode === "hide"}
        aria-keyshortcuts="X"
        title="Reveal or hide (X, or hold Alt)"
        className={buttonClass}
        onClick={props.onToggleMode}
      >
        {mode === "reveal" ? "◐ Revealing" : "◑ Hiding"}
      </button>
      {tool === "brush" && (
        <label className="flex items-center gap-2">
          Brush size
          <input
            type="range"
            min={BRUSH_SIZES.min * 100}
            max={BRUSH_SIZES.max * 100}
            step={0.5}
            value={radius * 100}
            aria-keyshortcuts="[ ]"
            onChange={(event) => props.onRadius(Number(event.target.value) / 100)}
          />
        </label>
      )}
      <button type="button" className={buttonClass} onClick={props.onRevealAll}>
        Reveal all
      </button>
      <button type="button" className={buttonClass} onClick={props.onHideAll}>
        Hide all
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        Redo
      </button>
      <span className="ml-auto flex items-center gap-3 text-stone-500">
        <span>{Math.round(props.revealed * 100)}% revealed</span>
        <span role="status" aria-live="polite" className="min-w-28">
          {status.kind === "saved" && "✓ Saved"}
          {status.kind === "saving" && "Saving…"}
          {status.kind === "error" && (
            <span className="text-rose-700 dark:text-rose-400">{status.message}</span>
          )}
        </span>
      </span>
    </div>
  );
}
