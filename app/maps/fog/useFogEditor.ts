import { useEffect, useState, useSyncExternalStore } from "react";
import { FogEditor } from "./editor";
import type { FogView } from "./types";

/**
 * The DM's fog editor for an open map, for React. It saves in the background, saves anything
 * waiting when the page is left, and warns before closing the tab with anything unsaved.
 */
export function useFogEditor(initial: FogView, url: string) {
  const [editor] = useState(() => new FogEditor(initial, url));
  const snapshot = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);

  useEffect(() => () => editor.flush(), [editor]);

  useEffect(() => {
    if (!snapshot.unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snapshot.unsaved]);

  return { editor, ...snapshot };
}
