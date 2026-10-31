import type { MarkerToken, TokenId } from "~/maps/tokens/types";

/** Says what the next click on the map places, and lets the DM change their mind. */
export function PlacingHint({ placing, onCancel }: { placing: Placing; onCancel: () => void }) {
  return (
    <p role="status" className="rounded bg-info-surface px-2 py-1 text-sm text-info">
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
  /** New NPCs or markers, side by side ("Bandit 1 to Bandit 3"). */
  | { kind: "markers"; name: string; markers: MarkerDraft[] }
  /** A marker set aside, or on another map, brought here. */
  | { kind: "bring"; id: TokenId; name: string };

/** A new marker, as the DM fills it in, before it has a place. */
export type MarkerDraft = Pick<
  MarkerToken,
  "name" | "colour" | "visibility" | "note" | "picture" | "icon" | "statblock" | "size"
>;
