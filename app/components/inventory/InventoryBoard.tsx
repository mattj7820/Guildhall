import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { InventoryChange } from "~/characters/inventory-changes";
import type { InventoryItem, ItemId } from "~/characters/types";
import type { GiftRecipient } from "~/characters/view";
import { REMOVE_ZONE } from "./drag-ids";
import { EquippedSlots, GiveTargets, RemoveZone } from "./DropZones";
import { ItemTooltip } from "./ItemTooltip";
import { TileFace } from "./ItemTile";
import { useColumns } from "./keyboard";
import { SortableTile } from "./SortableTile";
import { useInventoryDrag } from "./useInventoryDrag";

const TOOLTIP_DELAY_MS = 400;

interface Props {
  items: InventoryItem[];
  /** Only these are shown (a search or filter); moving is off while some are hidden. */
  visible?: ReadonlySet<ItemId>;
  onChange: (change: InventoryChange) => void;
  onOpen: (id: ItemId, focus?: "split" | "give") => void;
  onAdd: () => void;
  /** Who items can be given to; none means no giving. */
  recipients?: GiftRecipient[];
  onGive?: (id: ItemId, to: string, amount: number) => void;
  /** Above the grid, inside the drag area (so the equipped slots can take drops). */
  toolbar?: ReactNode;
}

/**
 * The bag: item tiles in a grid that grows as needed, the equipped slots, and a place to drop
 * things to remove them. Tiles move by mouse drag, a long press and drag on touch screens, or
 * the keyboard (Space picks up, arrows move, Space drops, Escape puts back). Dropping onto an
 * identical item stacks them; Shift while picking up carries half the stack. An item dragged
 * out of the equipped slots is unequipped, and one dropped on a portrait is given away.
 */
export function InventoryBoard({
  items: latest,
  visible,
  onChange,
  onOpen,
  onAdd,
  recipients = [],
  onGive,
  toolbar,
}: Props) {
  // A stable ID for dnd-kit, whose own counter differs between server and browser rendering.
  const dndId = useId();
  const instructionsId = useId();
  const tooltipId = useId();
  const gridRef = useRef<HTMLUListElement>(null);
  const columns = useColumns(gridRef);
  const { items, drag, dragged, overId, stackTarget, byId, justDropped, caption, ...dnd } =
    useInventoryDrag({
      latest,
      recipients,
      columns,
      onChange,
      onGive,
      focusItem,
      onPickUp: hideTooltip,
    });
  const filtered = visible !== undefined && visible.size < items.length;
  const shown = filtered ? items.filter((item) => visible.has(item.id)) : items;

  // Keyboard focus moves between tiles with the arrow keys; only one tile is in the tab order.
  const tileRefs = useRef(new Map<ItemId, HTMLButtonElement>());
  const [focused, setFocused] = useState<ItemId>();
  const focusable = shown.some((item) => item.id === focused) ? focused : shown[0]?.id;

  function focusItem(id: ItemId) {
    setFocused(id);
    requestAnimationFrame(() => tileRefs.current.get(id)?.focus());
  }

  function handleTileKey(event: KeyboardEvent, item: InventoryItem): boolean {
    const at = shown.indexOf(item);
    const moveTo = (index: number) => {
      const next = shown[Math.max(0, Math.min(shown.length - 1, index))];
      if (next) focusItem(next.id);
    };
    switch (event.key) {
      case "ArrowRight":
        moveTo(at + 1);
        return true;
      case "ArrowLeft":
        moveTo(at - 1);
        return true;
      case "ArrowDown":
        moveTo(at + columns);
        return true;
      case "ArrowUp":
        moveTo(at - columns);
        return true;
      case "Home":
        moveTo(0);
        return true;
      case "End":
        moveTo(shown.length - 1);
        return true;
      case "Enter":
        onOpen(item.id);
        return true;
      case "e":
      case "E":
        onChange({ type: "equip", id: item.id, equipped: !item.equipped });
        return true;
      case "s":
      case "S":
        if (item.quantity > 1) onOpen(item.id, "split");
        return true;
      case "g":
      case "G":
        if (recipients.length > 0) onOpen(item.id, "give");
        return true;
      case "+":
      case "=":
        onChange({ type: "quantity", id: item.id, quantity: item.quantity + 1 });
        return true;
      case "-":
      case "_":
        onChange({ type: "quantity", id: item.id, quantity: item.quantity - 1 });
        return true;
      case "Delete": {
        const next = shown[at + 1] ?? shown[at - 1];
        onChange({ type: "remove", id: item.id });
        if (next) focusItem(next.id);
        return true;
      }
      default:
        return false;
    }
  }

  // Tooltips: after a short hover, or straight away when a tile gets keyboard focus.
  const [tooltip, setTooltip] = useState<{ id: ItemId; anchor: DOMRect }>();
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const tooltipItem = tooltip && !drag ? byId(tooltip.id) : undefined;

  function showTooltip(id: ItemId, element: HTMLElement, delay: number) {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(
      () => setTooltip({ id, anchor: element.getBoundingClientRect() }),
      delay,
    );
  }

  function hideTooltip() {
    clearTimeout(hoverTimer.current);
    setTooltip(undefined);
  }

  // One row of empty slots after the last item, and the rest of its row, so it reads as a bag.
  const cells = shown.length + 1;
  const emptySlots = filtered ? 0 : ((columns - (cells % columns)) % columns) + columns;
  const equipped = items.filter((item) => item.equipped);

  return (
    <DndContext
      id={dndId}
      {...dnd.contextProps}
      accessibility={{
        announcements: dnd.announcements,
        screenReaderInstructions: {
          draggable:
            "Enter opens the item. Space picks it up to move it or stack it onto an identical item. E equips or unequips, S splits a stack, G gives it to someone, plus and minus change the quantity, Delete removes it.",
        },
      }}
    >
      {recipients.length > 0 && <GiveTargets recipients={recipients} dragging={!!drag} />}
      <EquippedSlots
        items={equipped}
        dragging={!!drag && !drag.fromSlot}
        lifted={drag?.fromSlot ? drag.id : undefined}
        onOpen={onOpen}
        onUnequip={(id) => onChange({ type: "equip", id, equipped: false })}
      />
      {toolbar}
      <SortableContext items={shown.map((item) => item.id)} strategy={dnd.strategy}>
        <ul
          ref={gridRef}
          aria-label="Inventory"
          aria-describedby={instructionsId}
          className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-x-2 gap-y-3"
        >
          {shown.map((item) => (
            <SortableTile
              key={item.id}
              item={item}
              disabled={filtered}
              tabbable={item.id === focusable}
              state={
                drag?.id === item.id && !drag.fromSlot
                  ? drag.splitting === undefined
                    ? "placeholder"
                    : "idle"
                  : stackTarget === item.id
                    ? "stackTarget"
                    : "idle"
              }
              quantity={
                drag?.id === item.id && drag.splitting !== undefined
                  ? item.quantity - drag.splitting
                  : item.quantity
              }
              describedBy={tooltip?.id === item.id ? tooltipId : undefined}
              registerRef={(element) => {
                if (element) tileRefs.current.set(item.id, element);
                else tileRefs.current.delete(item.id);
              }}
              onClick={() => {
                if (!justDropped.current) onOpen(item.id);
              }}
              onKeyDown={(event) => (drag ? false : handleTileKey(event, item))}
              onFocus={(event) => {
                setFocused(item.id);
                if (event.currentTarget.matches(":focus-visible")) {
                  showTooltip(item.id, event.currentTarget, 0);
                }
              }}
              onBlur={hideTooltip}
              onPointerEnter={(event) => {
                // Touch has no hover (and no "leave" to hide it again): a tap opens the item.
                if (event.pointerType === "mouse") {
                  showTooltip(item.id, event.currentTarget, TOOLTIP_DELAY_MS);
                }
              }}
              onPointerLeave={hideTooltip}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={onAdd}
              aria-label="Add an item"
              className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed border-line-strong text-3xl text-faint hover:border-accent hover:text-link"
            >
              +
            </button>
          </li>
          {Array.from({ length: emptySlots }, (_, index) => (
            <li
              key={`empty-${index}`}
              aria-hidden="true"
              className="aspect-square rounded-lg border-2 border-line/70 bg-raised/40"
            />
          ))}
        </ul>
      </SortableContext>
      <p id={instructionsId} className="sr-only">
        Arrow keys move between items.
      </p>
      {filtered && (
        <p className="mt-2 text-sm text-muted">
          Showing {shown.length} of {items.length}. Clear the search to rearrange items.
        </p>
      )}
      <RemoveZone dragging={!!drag} />
      <DragOverlay dropAnimation={null}>
        {drag && dragged ? (
          <div className="relative">
            <TileFace item={dragged} state="lifted" quantity={drag.splitting ?? dragged.quantity} />
            {caption && (
              <span
                className={[
                  "absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap text-on-accent shadow",
                  overId === REMOVE_ZONE ? "bg-danger" : "bg-accent",
                ].join(" ")}
              >
                {caption}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
      {tooltipItem && tooltip && (
        <ItemTooltip id={tooltipId} item={tooltipItem} anchor={tooltip.anchor} />
      )}
    </DndContext>
  );
}
