import type { ReactNode } from "react";
import type { MapTool } from "./useMapTools";

interface ToolButton {
  tool: MapTool;
  label: string;
  key: string;
  icon: string;
}

/** Simple line icons, drawn for Guildhall (24 × 24). */
const TOOLS: ToolButton[] = [
  { tool: "select", label: "Select and move", key: "V", icon: "M5 3l6 17 2.2-7 7-2.2z" },
  {
    tool: "measure",
    label: "Measure",
    key: "M",
    icon: "M3 16.5 16.5 3 21 7.5 7.5 21zM7 12.5l1.8 1.8M10 9.5l1.8 1.8M13 6.5l1.8 1.8",
  },
  {
    tool: "area",
    label: "Spell area",
    key: "A",
    icon: "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  },
];

export function ToolIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const toolButtonClass = (active: boolean) =>
  `flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md px-2 ${
    active
      ? "bg-amber-700 text-white dark:bg-amber-600"
      : "text-stone-700 hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-700"
  }`;

export const floatingPanelClass =
  "pointer-events-auto rounded-lg bg-white/95 p-1 shadow-md dark:bg-stone-900/95";

interface Props {
  /** The tools this map offers. */
  tools?: readonly MapTool[];
  tool: MapTool;
  onTool: (tool: MapTool) => void;
  /** What the tool in use is showing: a length, who's in an area. */
  result?: string;
  /** The tool's own options, beside the toolbar (the spell area's shapes). */
  children?: ReactNode;
}

/**
 * The map's tools, over its top-left corner: select and move, measure, spell area. Measuring and
 * spell areas show only on this viewer's screen.
 */
export function MapToolbar({ tools, tool, onTool, result, children }: Props) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-start gap-2">
      <div
        role="toolbar"
        aria-label="Map tools"
        aria-orientation="vertical"
        className={`${floatingPanelClass} flex flex-col gap-1`}
      >
        {TOOLS.filter((each) => !tools || tools.includes(each.tool)).map((each) => (
          <button
            key={each.tool}
            type="button"
            aria-label={each.label}
            aria-pressed={tool === each.tool}
            aria-keyshortcuts={each.key}
            title={`${each.label} (${each.key})`}
            className={toolButtonClass(tool === each.tool)}
            onClick={() => onTool(each.tool)}
          >
            <ToolIcon d={each.icon} />
          </button>
        ))}
      </div>
      {children}
      {result && (
        <p
          role="status"
          aria-label="Tool result"
          className={`${floatingPanelClass} px-3 py-2 text-sm font-semibold`}
        >
          {result}
        </p>
      )}
    </div>
  );
}
