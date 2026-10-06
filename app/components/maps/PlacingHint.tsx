import type { MarkerColour } from "~/maps/tokens/types";

/** Says what the next click on the map places, and lets the DM change their mind. */
export function PlacingHint({ placing, onCancel }: { placing: Placing; onCancel: () => void }) {
  return (
    <p
      role="status"
      className="rounded bg-sky-50 px-2 py-1 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100"
    >
      Click the map to place {placing.name}.{" "}
      <button type="button" className="underline" onClick={onCancel}>
        Cancel
      </button>
    </p>
  );
}

/** What the DM's next click on the map will place. */
export type Placing =
  | { kind: "character"; note: string; name: string }
  | { kind: "party"; name: string }
  | { kind: "marker"; name: string; colour: MarkerColour; shown: boolean };
