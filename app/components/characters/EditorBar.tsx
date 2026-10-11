import type { EditorSnapshot, Notice } from "~/characters/editor";
import { buttonClass, iconButtonClass } from "../styles";

/** The save status, Undo and Redo, and anything the sheet needs to tell its editor. */
export function EditorBar({
  editor,
  children,
}: {
  editor: EditorSnapshot & { undo: () => void; redo: () => void; dismiss: (id: number) => void };
  children?: React.ReactNode;
}) {
  const { status } = editor;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={editor.undo}
          disabled={!editor.canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={editor.redo}
          disabled={!editor.canRedo}
        >
          Redo
        </button>
        <p
          role="status"
          className={`text-sm ${status.kind === "error" ? "text-danger" : "text-muted"}`}
        >
          {status.kind === "error"
            ? status.message
            : status.kind === "saving" || editor.unsaved
              ? "Saving…"
              : "✓ All changes saved"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
      <Notices notices={editor.notices} onDismiss={editor.dismiss} />
    </div>
  );
}

function Notices({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) {
  if (notices.length === 0) return null;
  return (
    <ul aria-label="Notices" aria-live="polite" className="mt-2 space-y-1">
      {notices.map((notice) => (
        <li
          key={notice.id}
          className="flex items-center gap-2 rounded-md bg-info-surface px-3 py-1.5 text-sm text-info"
        >
          <span className="mr-auto">{notice.text}</span>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Dismiss"
            onClick={() => onDismiss(notice.id)}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
