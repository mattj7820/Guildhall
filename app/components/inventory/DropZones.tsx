import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { InventoryItem, ItemId } from "~/characters/types";
import type { GiftRecipient } from "~/characters/view";
import { EQUIP_ZONE, GIVE_PREFIX, REMOVE_ZONE, SLOT_PREFIX } from "./drag-ids";
import { TileFace, tileLabel } from "./ItemTile";

/* The bag's places to drop an item, besides the grid: equipped slots, portraits and remove. */

export function EquippedSlots({
  items,
  dragging,
  lifted,
  onOpen,
  onUnequip,
}: {
  items: InventoryItem[];
  /** Something from the grid is being dragged, which could be dropped here. */
  dragging: boolean;
  /** The slot being dragged out, if any. */
  lifted?: ItemId;
  onOpen: (id: ItemId) => void;
  onUnequip: (id: ItemId) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: EQUIP_ZONE });
  const empty = Math.max(0, 4 - items.length);
  return (
    <section aria-label="Equipped" className="mb-4">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
        Equipped
      </h3>
      <div
        ref={setNodeRef}
        className={[
          "flex flex-wrap gap-3 rounded-lg p-2 transition",
          isOver
            ? "bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-950/60"
            : dragging
              ? "bg-amber-50/60 ring-1 ring-amber-300 dark:bg-amber-950/20 dark:ring-amber-800"
              : "bg-stone-100/60 dark:bg-stone-900/60",
        ].join(" ")}
      >
        {items.length === 0 && (
          <p className="sr-only">Nothing equipped. Drag an item here, or press E on it.</p>
        )}
        <ul className="contents">
          {items.map((item) => (
            <EquippedSlot
              key={item.id}
              item={item}
              lifted={lifted === item.id}
              onOpen={onOpen}
              onUnequip={onUnequip}
            />
          ))}
        </ul>
        {Array.from({ length: empty }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="aspect-square w-12 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-700"
          />
        ))}
        {isOver && (
          <span className="self-center text-sm text-amber-800 dark:text-amber-300">Equip</span>
        )}
      </div>
    </section>
  );
}

/** An equipped item: click for details; drag it back into the bag, or press ✕ or E, to unequip. */
function EquippedSlot({
  item,
  lifted,
  onOpen,
  onUnequip,
}: {
  item: InventoryItem;
  lifted: boolean;
  onOpen: (id: ItemId) => void;
  onUnequip: (id: ItemId) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: SLOT_PREFIX + item.id });
  return (
    <li className="relative w-12 touch-manipulation">
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        // Moving by keyboard happens in the grid; here E (or the ✕) unequips.
        onKeyDown={(event) => {
          if (event.key === "e" || event.key === "E") {
            event.preventDefault();
            onUnequip(item.id);
          }
        }}
        aria-roledescription="equipped item"
        aria-label={tileLabel(item)}
        title={item.name}
        onClick={() => onOpen(item.id)}
        className="block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <TileFace item={item} state={lifted ? "placeholder" : "idle"} />
      </button>
      <button
        type="button"
        aria-label={`Unequip ${item.name}`}
        title="Unequip"
        onClick={() => onUnequip(item.id)}
        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-[10px] leading-none text-stone-600 shadow-sm hover:border-rose-400 hover:text-rose-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
      >
        ✕
      </button>
    </li>
  );
}

/** Portraits to drop an item on to give it away. Drop targets only: by keyboard, it's G. */
export function GiveTargets({
  recipients,
  dragging,
}: {
  recipients: GiftRecipient[];
  dragging: boolean;
}) {
  return (
    <section aria-label="Give to" className="mb-3">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">Give to</h3>
      <ul className="flex flex-wrap gap-2">
        {recipients.map((recipient) => (
          <GiveTarget key={recipient.id} recipient={recipient} dragging={dragging} />
        ))}
      </ul>
    </section>
  );
}

function GiveTarget({ recipient, dragging }: { recipient: GiftRecipient; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: GIVE_PREFIX + recipient.id });
  return (
    <li
      ref={setNodeRef}
      className={[
        "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition",
        isOver
          ? "scale-105 bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-950/60"
          : dragging
            ? "bg-amber-50/60 ring-1 ring-amber-300 dark:bg-amber-950/20 dark:ring-amber-800"
            : "bg-stone-100/60 dark:bg-stone-900/60",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full font-serif font-bold",
          recipient.companion
            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
            : "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100",
        ].join(" ")}
      >
        {recipient.name.slice(0, 1).toUpperCase()}
      </span>
      <span>
        {isOver ? `Give to ${recipient.name}` : recipient.name}
        {recipient.companion && !isOver && (
          <span className="ml-1 text-xs text-stone-500">companion</span>
        )}
      </span>
    </li>
  );
}

export function RemoveZone({ dragging }: { dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: REMOVE_ZONE });
  return (
    <div
      ref={setNodeRef}
      aria-hidden="true"
      className={[
        "mt-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-sm transition",
        isOver
          ? "border-rose-500 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
          : dragging
            ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
            : "border-stone-200 text-stone-400 dark:border-stone-800 dark:text-stone-600",
      ].join(" ")}
    >
      <TrashIcon /> {isOver ? "Let go to remove" : "Drag here to remove"}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}
