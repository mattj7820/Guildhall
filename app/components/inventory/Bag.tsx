import { useMemo, useState } from "react";
import type { InventoryChange, InventoryState } from "~/characters/inventory-changes";
import type { SortOrder } from "~/characters/inventory";
import type { ItemId } from "~/characters/types";
import type { CatalogueItem, LinkedNote } from "~/characters/view";
import { buttonClass, inputClass } from "../styles";
import { InventoryBoard, type Recipient } from "./InventoryBoard";
import { ItemDetails } from "./ItemDetails";
import { Purse } from "./Purse";
import { QuickAdd } from "./QuickAdd";

type Filter = "all" | "equipped";

/**
 * Everything in a character's bag: the equipped slots, the item grid with quick add, search and
 * sorting, the coins, and an item's details when it's opened.
 */
export function Bag({
  state,
  onChange,
  catalogue,
  notes,
  recipients,
  onGive,
}: {
  state: InventoryState;
  onChange: (change: InventoryChange) => void;
  /** Vault item notes this person may add. */
  catalogue: CatalogueItem[];
  /** Linked notes as this person may see them, by entity ID. */
  notes: Record<string, LinkedNote>;
  /** Who items can be given to, and how. */
  recipients?: Recipient[];
  onGive?: (id: ItemId, to: string, amount: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState<{ id: ItemId; focus?: "split" | "give" }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text && filter === "all") return undefined;
    return new Set(
      state.items
        .filter((item) => filter === "all" || item.equipped)
        .filter((item) => !text || item.name.toLowerCase().includes(text))
        .map((item) => item.id),
    );
  }, [state.items, query, filter]);

  const openedItem = opened && state.items.find((item) => item.id === opened.id);

  function open(id: ItemId, focus?: "split" | "give") {
    setOpened({ id, focus });
    const item = state.items.find((candidate) => candidate.id === id);
    if (item?.unseen) onChange({ type: "seen", id });
  }

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} onClick={() => setAdding(true)}>
        + Add item
      </button>
      <input
        type="search"
        aria-label="Search the bag"
        placeholder="Search…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`${inputClass} min-w-32 flex-1`}
      />
      <div
        role="group"
        aria-label="Show"
        className="flex overflow-hidden rounded-md border border-stone-300 text-sm dark:border-stone-700"
      >
        {(["all", "equipped"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "bg-stone-800 px-2 py-1 text-white dark:bg-stone-200 dark:text-stone-900"
                : "px-2 py-1 hover:bg-stone-100 dark:hover:bg-stone-800"
            }
          >
            {value === "all" ? "All" : "Equipped"}
          </button>
        ))}
      </div>
      <select
        aria-label="Sort the bag"
        value=""
        onChange={(event) => {
          if (event.target.value) {
            onChange({ type: "sort", order: event.target.value as SortOrder });
          }
        }}
        className={inputClass}
      >
        <option value="">Sort…</option>
        <option value="name">By name</option>
        <option value="equipped">Equipped first</option>
      </select>
    </div>
  );

  return (
    <div>
      {adding && (
        <QuickAdd
          catalogue={catalogue}
          onAdd={(item) => onChange({ type: "add", item })}
          onClose={() => setAdding(false)}
        />
      )}
      <InventoryBoard
        items={state.items}
        visible={visible}
        onChange={onChange}
        onOpen={open}
        onAdd={() => setAdding(true)}
        recipients={recipients}
        onGive={onGive}
        toolbar={toolbar}
      />
      <Purse purse={state.purse} onChange={onChange} />
      {openedItem && (
        <ItemDetails
          key={openedItem.id}
          item={openedItem}
          note={openedItem.note ? notes[openedItem.note] : undefined}
          focus={opened.focus}
          recipients={recipients}
          onChange={onChange}
          onGive={onGive}
          onClose={() => setOpened(undefined)}
        />
      )}
    </div>
  );
}
