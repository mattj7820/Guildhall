import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { InventoryChange } from "~/characters/inventory-changes";
import { canStack } from "~/characters/inventory";
import type { InventoryItem, ItemId } from "~/characters/types";
import { newId } from "~/shared/ids";
import { ItemTooltip } from "./ItemTooltip";
import { TileFace, tileLabel } from "./ItemTile";

const EQUIP_ZONE = "zone:equip";
const REMOVE_ZONE = "zone:remove";
const ZONES = new Set<UniqueIdentifier>([EQUIP_ZONE, REMOVE_ZONE]);
const TOOLTIP_DELAY_MS = 400;

interface Props {
  items: InventoryItem[];
  /** Only these are shown (a search or filter); moving is off while some are hidden. */
  visible?: ReadonlySet<ItemId>;
  onChange: (change: InventoryChange) => void;
  onOpen: (id: ItemId, focus?: "split") => void;
  onAdd: () => void;
  /** Above the grid, inside the drag area (so the equipped slots can take drops). */
  toolbar?: ReactNode;
}

interface Drag {
  id: ItemId;
  /** Shift held when picked up: carrying half the stack. */
  splitting: number | undefined;
}

/**
 * The bag: item tiles in a grid that grows as needed, the equipped slots, and a place to drop
 * things to remove them. Tiles move by mouse drag, a long press and drag on touch screens, or
 * the keyboard (Space picks up, arrows move, Space drops, Escape puts back). Dropping onto an
 * identical item stacks them; Shift while picking up carries half the stack.
 */
export function InventoryBoard({ items, visible, onChange, onOpen, onAdd, toolbar }: Props) {
  // A stable ID for dnd-kit, whose own counter differs between server and browser rendering.
  const dndId = useId();
  const instructionsId = useId();
  const tooltipId = useId();
  const filtered = visible !== undefined && visible.size < items.length;
  const shown = filtered ? items.filter((item) => visible.has(item.id)) : items;

  const [drag, setDrag] = useState<Drag>();
  const [stackTarget, setStackTarget] = useState<ItemId>();
  const justDropped = useRef(false);
  const keyboardDrag = useRef(false);

  const gridRef = useRef<HTMLUListElement>(null);
  const columns = useColumns(gridRef);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: listOrderCoordinates(columns),
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const byId = useCallback((id: UniqueIdentifier) => items.find((item) => item.id === id), [items]);
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
    setDrag({
      id: String(active.id),
      splitting: shift && item && item.quantity > 1 ? Math.floor(item.quantity / 2) : undefined,
    });
    setTooltip(undefined);
  }

  function handleDragOver({ over }: DragOverEvent) {
    const item = drag && carried(drag);
    const target = over && byId(over.id);
    setStackTarget(item && target && canStack(item, target) ? target.id : undefined);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = drag;
    const target = stackTarget;
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
    } else if (over.id === EQUIP_ZONE) {
      if (!item.equipped) onChange({ type: "equip", id: item.id, equipped: true });
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
    setDrag(undefined);
    setStackTarget(undefined);
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
      droppableContainers: args.droppableContainers.filter((container) => !ZONES.has(container.id)),
    });
  }, []);

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const item = byId(active.id);
      return item
        ? `Picked up ${item.name}. Use the arrow keys to move it, Space to drop it, Escape to put it back.`
        : undefined;
    },
    onDragOver: ({ active, over }) => announceOver(active.id, over?.id),
    onDragEnd: ({ active, over }) => {
      const item = byId(active.id);
      if (!item || !over) return item ? `Put ${item.name} back.` : undefined;
      if (over.id === REMOVE_ZONE) return `Removed ${item.name}.`;
      if (over.id === EQUIP_ZONE) return `Equipped ${item.name}.`;
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
    const target = byId(overId);
    if (!target) return undefined;
    if (drag && canStackOnto(drag, target)) return `Over ${target.name}: drop to stack.`;
    const position = items.indexOf(target) + 1;
    return `${item.name} is at position ${position} of ${items.length}.`;
  }

  function canStackOnto(current: Drag, target: InventoryItem) {
    const item = carried(current);
    return !!item && canStack(item, target);
  }

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
  const stackOnto = stackTarget ? byId(stackTarget) : undefined;
  const carriedItem = drag && carried(drag);
  const stackTotal =
    stackOnto && carriedItem ? stackOnto.quantity + carriedItem.quantity : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={finishDrag}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Enter opens the item. Space picks it up to move it or stack it onto an identical item. E equips, S splits a stack, plus and minus change the quantity, Delete removes it.",
        },
      }}
    >
      <EquippedSlots items={equipped} dragging={!!drag} onOpen={onOpen} />
      {toolbar}
      <SortableContext items={shown.map((item) => item.id)} strategy={strategy}>
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
                drag?.id === item.id
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
              onPointerEnter={(event) =>
                showTooltip(item.id, event.currentTarget, TOOLTIP_DELAY_MS)
              }
              onPointerLeave={hideTooltip}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={onAdd}
              aria-label="Add an item"
              className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-3xl text-stone-400 hover:border-amber-500 hover:text-amber-700 dark:border-stone-700 dark:text-stone-500 dark:hover:border-amber-500 dark:hover:text-amber-400"
            >
              +
            </button>
          </li>
          {Array.from({ length: emptySlots }, (_, index) => (
            <li
              key={`empty-${index}`}
              aria-hidden="true"
              className="aspect-square rounded-lg border-2 border-stone-200/70 bg-stone-100/40 dark:border-stone-800 dark:bg-stone-900/40"
            />
          ))}
        </ul>
      </SortableContext>
      <p id={instructionsId} className="sr-only">
        Arrow keys move between items.
      </p>
      {filtered && (
        <p className="mt-2 text-sm text-stone-500">
          Showing {shown.length} of {items.length}. Clear the search to rearrange items.
        </p>
      )}
      <RemoveZone dragging={!!drag} />
      <DragOverlay dropAnimation={null}>
        {drag && dragged ? (
          <div className="relative">
            <TileFace item={dragged} state="lifted" quantity={drag.splitting ?? dragged.quantity} />
            {stackTotal !== undefined && (
              <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-white shadow">
                Stack ×{stackTotal}
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

function SortableTile({
  item,
  disabled,
  tabbable,
  state,
  quantity,
  describedBy,
  registerRef,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
}: {
  item: InventoryItem;
  disabled: boolean;
  tabbable: boolean;
  state: "idle" | "placeholder" | "stackTarget";
  quantity: number;
  describedBy?: string;
  registerRef: (element: HTMLButtonElement | null) => void;
  onClick: () => void;
  /** True if the key was handled, so dragging doesn't also get it. */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => boolean;
  onFocus: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
  onPointerEnter: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: item.id, disabled });
  const instructions = attributes["aria-describedby"];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        ref={(element) => {
          setActivatorNodeRef(element);
          registerRef(element);
        }}
        aria-roledescription="item"
        aria-label={tileLabel(item)}
        aria-describedby={[instructions, describedBy].filter(Boolean).join(" ")}
        tabIndex={tabbable ? 0 : -1}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onKeyDown(event)) {
            event.preventDefault();
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className="group block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      >
        <span className="block transition group-hover:-translate-y-0.5">
          <TileFace item={item} state={state} quantity={quantity} />
        </span>
        <span className="mt-1 block truncate text-center text-[11px] leading-tight text-stone-600 dark:text-stone-400">
          {item.name}
        </span>
      </button>
    </li>
  );
}

function EquippedSlots({
  items,
  dragging,
  onOpen,
}: {
  items: InventoryItem[];
  dragging: boolean;
  onOpen: (id: ItemId) => void;
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
          "flex flex-wrap gap-2 rounded-lg p-2 transition",
          isOver
            ? "bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-950/60"
            : dragging
              ? "bg-amber-50/60 ring-1 ring-amber-300 ring-dashed dark:bg-amber-950/20 dark:ring-amber-800"
              : "bg-stone-100/60 dark:bg-stone-900/60",
        ].join(" ")}
      >
        {items.length === 0 && !dragging && (
          <p className="sr-only">Nothing equipped. Drag an item here, or press E on it.</p>
        )}
        <ul className="contents">
          {items.map((item) => (
            <li key={item.id} className="w-12">
              <button
                type="button"
                aria-label={tileLabel(item)}
                title={item.name}
                onClick={() => onOpen(item.id)}
                className="block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-amber-600"
              >
                <TileFace item={item} />
              </button>
            </li>
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

function RemoveZone({ dragging }: { dragging: boolean }) {
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

const STEPS: Record<string, (columns: number) => number> = {
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
  ArrowUp: (columns) => -columns,
  ArrowDown: (columns) => columns,
};

/**
 * Keyboard moves follow the bag's order, like the arrow keys do between tiles: Left at the start
 * of a row goes to the end of the row above. (dnd-kit's own version moves by position on screen,
 * so it can't leave the first or last column.)
 */
function listOrderCoordinates(columns: number): KeyboardCoordinateGetter {
  return (event, { context: { active, over, droppableRects } }) => {
    const step = STEPS[event.code];
    if (!step) return undefined;
    event.preventDefault();
    const order: UniqueIdentifier[] = active?.data.current?.sortable?.items ?? [];
    const from = order.indexOf(over?.id ?? active?.id ?? "");
    if (from < 0) return undefined;
    const to = Math.max(0, Math.min(order.length - 1, from + step(columns)));
    const rect = droppableRects.get(order[to]);
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };
}

/** How many columns the responsive grid has right now, for arrow keys and empty slots. */
function useColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(6);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const tracks = getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean);
      setColumns(Math.max(1, tracks.length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}
