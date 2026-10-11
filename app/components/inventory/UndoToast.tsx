import { useEffect, useState } from "react";

const SHOW_FOR_MS = 6000;

/**
 * "Removed Rope ×3 · Undo", for a few seconds after each change. Also read out to screen readers.
 */
export function UndoToast({
  message,
  serial,
  onUndo,
}: {
  message?: string;
  /** Changes with each new message, so the same text twice still shows again. */
  serial: number;
  /** None for a change that can't be undone. */
  onUndo?: () => void;
}) {
  /** The latest message that has timed out or been used. */
  const [hidden, setHidden] = useState<number>();

  useEffect(() => {
    const timer = setTimeout(() => setHidden(serial), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [serial]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      {message && hidden !== serial && (
        <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-page shadow-lg">
          {message}
          {onUndo && (
            <button
              type="button"
              onClick={() => {
                setHidden(serial);
                onUndo();
              }}
              className="font-semibold text-page underline hover:no-underline"
            >
              Undo
            </button>
          )}
        </p>
      )}
    </div>
  );
}
