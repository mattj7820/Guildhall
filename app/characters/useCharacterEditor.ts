import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CharacterAction } from "./actions";
import { CharacterEditor } from "./editor";
import type { Character } from "./types";
import { changesUrl, giveUrl } from "./urls";

/** How often an open sheet checks for changes made elsewhere (by the DM, or in another tab). */
const POLL_MS = 10_000;

/**
 * An open sheet's editor, for React: its current state, and the ways to change it. It saves in
 * the background, checks for others' changes while the tab is visible and when it's focused,
 * warns before closing the tab with anything unsaved, and handles Ctrl+Z and Ctrl+Shift+Z outside
 * text boxes (which keep their own undo).
 */
export function useCharacterEditor(initial: Character) {
  const [editor] = useState(
    () => new CharacterEditor(initial, changesUrl(initial.id), giveUrl(initial.id)),
  );
  const snapshot = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);

  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void editor.refresh();
    }, POLL_MS);
    const onFocus = () => void editor.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      // Leaving the sheet: save anything still waiting.
      editor.flush();
    };
  }, [editor]);

  useEffect(() => {
    if (!snapshot.unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snapshot.unsaved]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  const controls = useMemo(
    () => ({
      dispatch: (...actions: CharacterAction[]) => editor.dispatch(...actions),
      dispatchWithoutUndo: (...actions: CharacterAction[]) =>
        editor.dispatchWithoutUndo(...actions),
      undo: () => editor.undo(),
      redo: () => editor.redo(),
      flush: () => editor.flush(),
      dismiss: (id: number) => editor.dismiss(id),
      give: (gift: { item: string; amount: number; to: string }) => editor.give(gift),
    }),
    [editor],
  );
  return { ...snapshot, ...controls };
}

export type CharacterEditorControls = ReturnType<typeof useCharacterEditor>;
