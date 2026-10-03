import {
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { rectSortingStrategy, type SortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useMemo, useRef, useState } from "react";
import { canStack } from "~/characters/inventory";
import type { InventoryChange } from "~/characters/inventory-changes";
import type { InventoryItem, ItemId } from "~/characters/types";
import type { GiftRecipient } from "~/characters/view";
import { newId } from "~/shared/ids";
import { EQUIP_ZONE, GIVE_PREFIX, isZone, itemIdOf, REMOVE_ZONE, SLOT_PREFIX } from "./drag-ids";
import { listOrderCoordinates } from "./keyboard";

export interface Drag {
  id: ItemId;
  /** Shift held when picked up: carrying half the stack. */
  splitting: number | undefined;
  /** Picked up from the equipped slots rather than the grid. */
  fromSlot: boolean;
}

/**
 * The bag's drag and drop: what's being carried and what it's over, what letting go does (move,
 * stack, split, equip, unequip, give or remove), and what a screen reader is told meanwhile. The
 * board lays it out; this is the state and rules.
 */
export function useInventoryDrag({
  latest,
  recipients,
  columns,
  onChange,
  onGive,
  focusItem,
  onPickUp,
}: {
  latest: InventoryItem[];
  recipients: GiftRecipient[];
  /** The grid's columns, for the arrow keys up and down. */
  columns: number;
  onChange: (change: InventoryChange) => void;
  onGive?: (id: ItemId, to: string, amount: number) => void;
  /** Moves keyboard focus to a tile, after a drop. */
  focusItem: (id: ItemId) => void;
  /** Something was picked up (the board hides its tooltip). */
  onPickUp: () => void;
}) {
  // While something is being dragged, the bag holds still: changes arriving from elsewhere (the
  // DM, another tab) wait until it's dropped, so nothing moves under the pointer.
  const [held, setHeld] = useState<InventoryItem[]>();
  const items = held ?? latest;

  const [drag, setDrag] = useState<Drag>();
  const [stackTarget, setStackTarget] = useState<ItemId>();
  /** What the dragged item is over, for the caption saying what dropping it will do. */
  const [overId, setOverId] = useState<UniqueIdentifier>();
  const justDropped = useRef(false);
  const dragging = useRef<Drag>(undefined);
  const keyboardDrag = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: listOrderCoordinates(columns),
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const byId = useCallback(
    (id: UniqueIdentifier) => items.find((item) => item.id === itemIdOf(id)),
    [items],
  );
  const dragged = drag && byId(drag.id);

  /** What the carried item would be if dropped: half a stack, never equipped, when splitting. */
  const carried = useCallback(
    (current: Drag): InventoryItem | undefined => {
      const item = byId(current.id);
      if (!item || current.splitting === undefined) return item;
      return { ...item, quantity: current.splitting, equipped: false, attuned: false };
    },
    [byId],
  );

  function handleDragStart({ active, activatorEvent }: DragStartEvent) {
    const item = byId(active.id);
    const shift = activatorEvent instanceof MouseEvent && activatorEvent.shiftKey;
    keyboardDrag.current = activatorEvent instanceof KeyboardEvent;
    const fromSlot = String(active.id).startsWith(SLOT_PREFIX);
    const started: Drag = {
      id: itemIdOf(active.id),
      splitting:
        shift && !fromSlot && item && item.quantity > 1 ? Math.floor(item.quantity / 2) : undefined,
      fromSlot,
    };
    // The first "over" can arrive before React re-renders with the new state, so the handlers
    // read the drag from here.
    dragging.current = started;
    setDrag(started);
    setHeld(latest);
    onPickUp();
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id);
    setStackTarget(stackOnto(dragging.current, over?.id)?.id);
  }

  /** The identical stack under the carried item, if it's over one. */
  function stackOnto(current: Drag | undefined, overId: UniqueIdentifier | undefined) {
    const item = current && carried(current);
    const target = overId === undefined ? undefined : byId(overId);
    return item && target && canStack(item, target) ? target : undefined;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = dragging.current;
    const target = stackOnto(current, over?.id)?.id;
    finishDrag();
    const item = byId(active.id);
    if (!over || !item || !current) return;
    const half = current.splitting;

    if (over.id === REMOVE_ZONE) {
      onChange(
        half === undefined
          ? { type: "remove", id: item.id }
          : { type: "quantity", id: item.id, quantity: item.quantity - half },
      );
    } else if (String(over.id).startsWith(GIVE_PREFIX)) {
      onGive?.(item.id, String(over.id).slice(GIVE_PREFIX.length), half ?? item.quantity);
      return;
    } else if (over.id === EQUIP_ZONE) {
      if (!item.equipped) onChange({ type: "equip", id: item.id, equipped: true });
    } else if (current.fromSlot) {
      onChange({ type: "equip", id: item.id, equipped: false });
    } else if (target === over.id) {
      onChange(
        half === undefined
          ? { type: "stack", id: item.id, onto: target }
          : { type: "split", id: item.id, amount: half, newId: newId(), onto: target },
      );
    } else {
      const from = items.indexOf(item);
      const to = items.findIndex((candidate) => candidate.id === over.id);
      if (to < 0) return;
      if (half !== undefined) {
        // The sorted preview showed the new stack after the tile it was over when moving right.
        const index = to > from ? to + 1 : to;
        onChange({ type: "split", id: item.id, amount: half, newId: newId(), index });
      } else if (to !== from) {
        onChange({ type: "move", id: item.id, index: to });
      }
    }
    focusItem(item.id);
  }

  function finishDrag() {
    dragging.current = undefined;
    setDrag(undefined);
    setHeld(undefined);
    setStackTarget(undefined);
    setOverId(undefined);
    // Dropping ends with a click on the tile, which would open its details: straight after a
    // mouse drag, or when the Space that dropped it is let go.
    justDropped.current = true;
    const clear = () => setTimeout(() => (justDropped.current = false), 0);
    if (keyboardDrag.current) window.addEventListener("keyup", clear, { once: true });
    else clear();
  }

  // While something is held over an identical stack, the other tiles stay put: it's a drop onto
  // that tile, not a new position.
  const strategy = useMemo<SortingStrategy>(
    () => (args) => (stackTarget ? null : rectSortingStrategy(args)),
    [stackTarget],
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const underPointer = pointerWithin(args);
    if (underPointer.length > 0) return underPointer;
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => !isZone(container.id)),
    });
  }, []);

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const item = byId(active.id);
      if (!item) return undefined;
      return String(active.id).startsWith(SLOT_PREFIX)
        ? `Picked up ${item.name} from the equipped slots. Drop it in the bag to unequip it.`
        : `Picked up ${item.name}. Use the arrow keys to move it, Space to drop it, Escape to put it back.`;
    },
    onDragOver: ({ active, over }) => announceOver(active.id, over?.id),
    onDragEnd: ({ active, over }) => {
      const item = byId(active.id);
      if (!item || !over) return item ? `Put ${item.name} back.` : undefined;
      if (over.id === REMOVE_ZONE) return `Removed ${item.name}.`;
      if (over.id === EQUIP_ZONE) return `Equipped ${item.name}.`;
      const recipient = recipientOf(over.id);
      if (recipient) return `Gave ${item.name} to ${recipient.name}.`;
      return `Dropped ${item.name}.`;
    },
    onDragCancel: ({ active }) => {
      const item = byId(active.id);
      return item ? `Put ${item.name} back.` : undefined;
    },
  };

  function announceOver(activeId: UniqueIdentifier, overId: UniqueIdentifier | undefined) {
    const item = byId(activeId);
    if (!item || overId === undefined) return undefined;
    if (overId === EQUIP_ZONE) return "Over the equipped slots: drop to equip.";
    if (overId === REMOVE_ZONE) return "Over remove: drop to remove it.";
    const recipient = recipientOf(overId);
    if (recipient) return `Over ${recipient.name}: drop to give it to them.`;
    const target = byId(overId);
    if (!target) return undefined;
    if (stackOnto(dragging.current, target.id)) return `Over ${target.name}: drop to stack.`;
    const position = items.indexOf(target) + 1;
    return `${item.name} is at position ${position} of ${items.length}.`;
  }

  function recipientOf(id: UniqueIdentifier): GiftRecipient | undefined {
    const key = String(id);
    if (!key.startsWith(GIVE_PREFIX)) return undefined;
    return recipients.find((recipient) => recipient.id === key.slice(GIVE_PREFIX.length));
  }

  /** What letting go here will do, when it isn't simply "move it here". */
  function dropCaption(current: Drag): string | undefined {
    if (overId === undefined) return undefined;
    if (overId === REMOVE_ZONE) return "Remove";
    if (overId === EQUIP_ZONE) return current.fromSlot ? undefined : "Equip";
    const recipient = recipientOf(overId);
    if (recipient) return `Give to ${recipient.name}`;
    if (current.fromSlot) return "Unequip";
    const onto = stackTarget ? byId(stackTarget) : undefined;
    const item = carried(current);
    return onto && item ? `Stack ×${onto.quantity + item.quantity}` : undefined;
  }

  return {
    /** The bag as shown: held still while dragging. */
    items,
    drag,
    dragged,
    overId,
    stackTarget,
    byId,
    /** Set just after a drop, whose click on the tile mustn't open it. */
    justDropped,
    /** What letting go here will do, when it isn't simply "move it here". */
    caption: drag && dropCaption(drag),
    strategy,
    contextProps: {
      sensors,
      collisionDetection,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: finishDrag,
    },
    announcements,
  };
}
