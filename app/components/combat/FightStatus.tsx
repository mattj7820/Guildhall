import type { SaveStatus } from "~/combat/fight-saver";

/** Says when the fight isn't safely on the server, or was replaced by a newer one. */
export function FightStatus({ status }: { status: SaveStatus }) {
  if (status === "offline") {
    return (
      <p role="alert" className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">
        Can't reach Guildhall just now: changes are kept here and saved when it's back.
      </p>
    );
  }
  if (status === "refused") {
    return (
      <p role="alert" className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">
        Guildhall wouldn't save the last change, so the table doesn't see it. Reload to see the
        fight as it's saved.
      </p>
    );
  }
  if (status === "replaced") {
    return (
      <p role="status" className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
        The fight changed elsewhere (a player ended their turn, or another tab), so this is the
        latest. Check your last change made it.
      </p>
    );
  }
  if (status === "saving") {
    return (
      <p role="status" className="mb-2 text-right text-xs text-stone-500">
        Saving…
      </p>
    );
  }
  return null;
}
