import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FocusEvent, KeyboardEvent, PointerEvent } from "react";
import type { InventoryItem } from "~/characters/types";
import { TileFace, tileLabel } from "./ItemTile";

/** A tile in the bag's grid: dragged to move or stack it, and the grid's keys when it's focused. */
export function SortableTile({
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
  onFocus: (event: FocusEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
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
