import { iconById } from "~/characters/quick-add";
import type { IconRef, InventoryItem } from "~/characters/types";

/** A built-in icon, drawn in the current text colour. */
export function ItemIconSvg({ icon, className }: { icon: IconRef; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" className={className}>
      <path fill="currentColor" d={iconById(icon.builtin).path} />
    </svg>
  );
}

/** What a tile says to a screen reader: "Rope, 3, equipped, new". */
export function tileLabel(item: InventoryItem): string {
  return [
    item.name,
    item.quantity > 1 ? String(item.quantity) : undefined,
    item.equipped ? "equipped" : undefined,
    item.attuned ? "attuned" : undefined,
    item.unseen ? "new" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export type TileState = "idle" | "placeholder" | "lifted" | "stackTarget";

/**
 * The look of an item tile, shared by the grid, the equipped slots and the dragged copy. The
 * quantity sits bottom-right, equipped items get a gold corner, and new items a dot.
 */
export function TileFace({
  item,
  state = "idle",
  quantity = item.quantity,
}: {
  item: InventoryItem;
  state?: TileState;
  /** Shown instead of the item's own, e.g. half a stack while splitting. */
  quantity?: number;
}) {
  return (
    <span
      className={[
        "relative flex aspect-square w-full items-center justify-center rounded-lg border-2 transition",
        state === "placeholder"
          ? "border-dashed border-line-strong bg-transparent text-faint"
          : item.equipped
            ? "border-accent bg-accent-surface text-ink"
            : "border-line-strong bg-raised text-ink",
        state === "lifted" ? "scale-110 -rotate-3 shadow-xl" : "",
        state === "stackTarget" ? "scale-105 ring-4 ring-trim/80" : "",
      ].join(" ")}
    >
      <ItemIconSvg icon={item.icon} className="h-3/5 w-3/5" />
      {item.equipped && state !== "placeholder" && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 h-0 w-0 border-t-[14px] border-r-[14px] border-t-accent border-r-transparent"
        />
      )}
      {item.unseen && state !== "placeholder" && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 h-2.5 w-2.5 animate-pulse rounded-full bg-accent ring-2 ring-surface"
        />
      )}
      {quantity > 1 && state !== "placeholder" && (
        <span className="absolute right-1 bottom-0.5 text-xs font-bold text-ink tabular-nums [text-shadow:0_0_3px_white] dark:[text-shadow:0_0_3px_black]">
          {quantity}
        </span>
      )}
    </span>
  );
}
