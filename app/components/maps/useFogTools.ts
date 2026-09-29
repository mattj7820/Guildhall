import { useEffect, useState } from "react";
import { revealedCount } from "~/maps/fog/mask";
import type { FogChange, FogMode, FogView } from "~/maps/fog/types";
import { useFogEditor } from "~/maps/fog/useFogEditor";
import type { AreaView, MapId } from "~/maps/types";
import { mapFogUrl } from "~/maps/urls";
import type { FogTool } from "./FogPainter";
import { BRUSH_SIZES } from "./FogToolbar";

const SIZE_STEP = 1.25;

/**
 * The DM's fog tools on a map: the fog editor, and which tool, mode and brush size are chosen.
 * While `active`, keys choose them (B, A, R, X, [ and ]), holding Alt swaps revealing and hiding,
 * holding Space lets a drag pan the map, and Ctrl+Z and Ctrl+Shift+Z undo and redo.
 */
export function useFogTools(mapId: MapId, fog: FogView, active: boolean) {
  const editor = useFogEditor(fog, mapFogUrl(mapId));
  const [tool, setTool] = useState<FogTool>("brush");
  const [baseMode, setBaseMode] = useState<FogMode>("reveal");
  const [radius, setRadius] = useState(0.03);
  const [altHeld, setAltHeld] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const mode: FogMode = altHeld ? (baseMode === "reveal" ? "hide" : "reveal") : baseMode;
  const toggleMode = () => setBaseMode((current) => (current === "reveal" ? "hide" : "reveal"));

  useEffect(() => {
    if (!active) return;
    const resize = (factor: number) =>
      setRadius((current) =>
        Math.min(BRUSH_SIZES.max, Math.max(BRUSH_SIZES.min, current * factor)),
      );
    const onKeyDown = (event: KeyboardEvent) => {
      setAltHeld(event.altKey);
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.editor.redo();
        else editor.editor.undo();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      const keys: Record<string, () => void> = {
        b: () => setTool("brush"),
        a: () => setTool("area"),
        r: () => setTool("rectangle"),
        x: toggleMode,
        "[": () => resize(1 / SIZE_STEP),
        "]": () => resize(SIZE_STEP),
        " ": () => setSpaceHeld(true),
      };
      const action = keys[event.key.toLowerCase()];
      if (!action) return;
      // Space still presses a focused button or link; elsewhere it's for panning.
      if (event.key === " " && target.closest("button, a, [role=switch]")) return;
      event.preventDefault();
      action();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      setAltHeld(event.altKey);
      if (event.key === " ") setSpaceHeld(false);
      // On Windows, Alt on its own would move focus to the browser's menu.
      if (event.key === "Alt") event.preventDefault();
    };
    const onBlur = () => {
      setAltHeld(false);
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, editor.editor]);

  const change = (next: FogChange) => editor.editor.change(next);
  const paintArea = (area: AreaView, areaMode: FogMode) =>
    change({ type: "paint", mode: areaMode, shape: { kind: "polygon", points: area.outline } });

  return {
    ...editor,
    tool,
    setTool,
    mode,
    toggleMode,
    radius,
    setRadius,
    panning: spaceHeld,
    change,
    revealArea: (area: AreaView) => paintArea(area, "reveal"),
    hideArea: (area: AreaView) => paintArea(area, "hide"),
    revealAll: () => change({ type: "paint", mode: "reveal", shape: { kind: "all" } }),
    hideAll: () => change({ type: "paint", mode: "hide", shape: { kind: "all" } }),
    revealed: revealedCount(editor.mask) / editor.mask.cells.length,
  };
}
