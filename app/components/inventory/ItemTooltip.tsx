import type { InventoryItem } from "~/characters/types";

/**
 * A game-style tooltip for a tile: name, quantity, description and where it came from. Fixed to
 * the viewport, so a scrolling bag can't clip it; above the tile when there's room.
 */
export function ItemTooltip({
  id,
  item,
  anchor,
}: {
  id: string;
  item: InventoryItem;
  anchor: DOMRect;
}) {
  const above = anchor.top > 140;
  const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - 112, window.innerWidth - 232));
  return (
    <div
      id={id}
      role="tooltip"
      style={{
        left,
        ...(above ? { bottom: window.innerHeight - anchor.top + 8 } : { top: anchor.bottom + 8 }),
      }}
      className="pointer-events-none fixed z-50 w-56 rounded-lg border border-stone-700 bg-stone-900/95 px-3 py-2 text-sm text-stone-100 shadow-xl"
    >
      <p className="font-serif font-semibold text-amber-300">
        {item.name}
        {item.quantity > 1 && <span className="ml-1 text-stone-400">×{item.quantity}</span>}
      </p>
      {(item.equipped || item.attuned) && (
        <p className="text-xs text-amber-200/80">
          {[item.equipped && "Equipped", item.attuned && "Attuned"].filter(Boolean).join(" · ")}
        </p>
      )}
      {item.description && <p className="mt-1 text-stone-200">{item.description}</p>}
      {item.source?.text && <p className="mt-1 text-xs text-stone-400">From: {item.source.text}</p>}
      {item.givenBy && <p className="mt-1 text-xs text-amber-200/80">Given by {item.givenBy}</p>}
      {item.note && <p className="mt-1 text-xs text-stone-400">Has a note in the wiki</p>}
    </div>
  );
}
