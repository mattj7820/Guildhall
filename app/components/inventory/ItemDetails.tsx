import { useEffect, useRef, useState } from "react";
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  SOURCE_MAX,
  type InventoryChange,
} from "~/characters/inventory-changes";
import { QUANTITY_MAX } from "~/characters/inventory";
import { ITEM_ICONS } from "~/characters/item-icons";
import type { InventoryItem, ItemId } from "~/characters/types";
import type { LinkedNote } from "~/characters/view";
import { newId } from "~/shared/ids";
import { buttonClass, iconButtonClass, inputClass, labelClass } from "../styles";
import type { Recipient } from "./InventoryBoard";
import { ItemIconSvg } from "./ItemTile";

/**
 * Everything about one item, in a modal dialog (a bottom sheet on phones): its name, icon,
 * quantity, description and source, its linked wiki note, and what can be done with it.
 */
export function ItemDetails({
  item,
  note,
  focus,
  recipients = [],
  onChange,
  onGive,
  onClose,
}: {
  item: InventoryItem;
  note?: LinkedNote;
  /** Open with the split or give control focused. */
  focus?: "split" | "give";
  /** Who it can be given to; none hides giving. */
  recipients?: Recipient[];
  onChange: (change: InventoryChange) => void;
  onGive?: (id: ItemId, to: string, amount: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const splitInput = useRef<HTMLInputElement>(null);
  const giveSelect = useRef<HTMLSelectElement>(null);
  const [giveTo, setGiveTo] = useState(recipients[0]?.id ?? "");
  const [giveAmount, setGiveAmount] = useState(item.quantity);
  const [choosingIcon, setChoosingIcon] = useState(false);
  const [split, setSplit] = useState(Math.floor(item.quantity / 2));
  const edit = (changes: Extract<InventoryChange, { type: "edit" }>["changes"]) =>
    onChange({ type: "edit", id: item.id, changes });

  useEffect(() => {
    dialog.current?.showModal();
    if (focus === "split") splitInput.current?.focus();
    if (focus === "give") giveSelect.current?.focus();
  }, [focus]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`item-${item.id}-name`}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its content) closes it.
        if (event.target === dialog.current) dialog.current.close();
      }}
      className="m-auto mb-0 w-full max-w-lg rounded-t-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/50 sm:mb-auto sm:rounded-xl dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
    >
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-start gap-4">
          <div className="w-20 shrink-0">
            <span
              className={[
                "flex aspect-square items-center justify-center rounded-xl border-2",
                item.equipped
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                  : "border-stone-300 bg-stone-100 dark:border-stone-700 dark:bg-stone-800",
              ].join(" ")}
            >
              <ItemIconSvg icon={item.icon} className="h-3/5 w-3/5" />
            </span>
            <button
              type="button"
              aria-expanded={choosingIcon}
              onClick={() => setChoosingIcon(!choosingIcon)}
              className="mt-1 w-full text-xs text-stone-600 hover:underline dark:text-stone-400"
            >
              Change icon
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={`item-${item.id}-name`} className="sr-only">
              {item.name}
            </h2>
            <label className="block">
              <span className="sr-only">Name</span>
              <input
                key={item.name}
                defaultValue={item.name}
                maxLength={NAME_MAX}
                onBlur={(event) => {
                  if (event.target.value.trim() !== item.name) edit({ name: event.target.value });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="w-full rounded border border-transparent bg-transparent px-1 font-serif text-2xl font-bold hover:border-stone-300 focus:border-stone-400 dark:hover:border-stone-700"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1" role="group" aria-label="Quantity">
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label="One fewer"
                  disabled={item.quantity <= 1}
                  onClick={() =>
                    onChange({ type: "quantity", id: item.id, quantity: item.quantity - 1 })
                  }
                >
                  −
                </button>
                <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">
                  ×{item.quantity}
                </span>
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label="One more"
                  disabled={item.quantity >= QUANTITY_MAX}
                  onClick={() =>
                    onChange({ type: "quantity", id: item.id, quantity: item.quantity + 1 })
                  }
                >
                  +
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={item.equipped}
                  onChange={(event) =>
                    onChange({ type: "equip", id: item.id, equipped: event.target.checked })
                  }
                />
                Equipped
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={item.attuned}
                  onChange={(event) =>
                    onChange({ type: "attune", id: item.id, attuned: event.target.checked })
                  }
                />
                Attuned
              </label>
            </div>
            {item.givenBy && (
              <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
                Given by {item.givenBy}
              </p>
            )}
          </div>
        </div>

        {choosingIcon && (
          <fieldset className="mt-3">
            <legend className={labelClass}>Icon</legend>
            <div className="mt-1 grid grid-cols-8 gap-1 sm:grid-cols-10">
              {ITEM_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  aria-label={icon.label}
                  aria-pressed={icon.id === item.icon.builtin}
                  title={icon.label}
                  onClick={() => {
                    edit({ icon: { builtin: icon.id } });
                    setChoosingIcon(false);
                  }}
                  className={[
                    "aspect-square rounded p-1",
                    icon.id === item.icon.builtin
                      ? "bg-amber-200 dark:bg-amber-800"
                      : "hover:bg-stone-100 dark:hover:bg-stone-800",
                  ].join(" ")}
                >
                  <ItemIconSvg icon={{ builtin: icon.id }} className="h-full w-full" />
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="mt-4 block">
          <span className={labelClass}>Description</span>
          <textarea
            key={item.description}
            defaultValue={item.description}
            maxLength={DESCRIPTION_MAX}
            rows={2}
            placeholder="A line or two, if you like"
            onBlur={(event) => {
              if (event.target.value.trim() !== (item.description ?? "")) {
                edit({ description: event.target.value });
              }
            }}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <label className="mt-3 block">
          <span className={labelClass}>Came from</span>
          <input
            key={item.source?.text}
            defaultValue={item.source?.text}
            maxLength={SOURCE_MAX}
            placeholder="e.g. the old mill, Session 3"
            onBlur={(event) => {
              if (event.target.value.trim() !== (item.source?.text ?? "")) {
                edit({ source: { ...item.source, text: event.target.value } });
              }
            }}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        {note && (
          <section className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={labelClass}>From the wiki: {note.title}</h3>
              <a
                href={note.url}
                className="text-sm text-amber-800 hover:underline dark:text-amber-400"
              >
                Open in wiki
              </a>
            </div>
            <div
              className="note-body prose prose-stone prose-sm dark:prose-invert mt-2 max-w-none [&>h1:first-child]:hidden"
              dangerouslySetInnerHTML={{ __html: note.html }}
            />
          </section>
        )}

        {recipients.length > 0 && onGive && (
          <fieldset className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3 text-sm dark:border-stone-700">
            <legend className="sr-only">Give</legend>
            <label className="flex items-center gap-1">
              Give
              {item.quantity > 1 && (
                <input
                  type="number"
                  aria-label="How many to give"
                  min={1}
                  max={item.quantity}
                  value={giveAmount}
                  onChange={(event) => setGiveAmount(Number(event.target.value))}
                  className={`${inputClass} w-16`}
                />
              )}
            </label>
            <label className="flex items-center gap-1">
              to
              <select
                ref={giveSelect}
                value={giveTo}
                onChange={(event) => setGiveTo(event.target.value)}
                className={inputClass}
              >
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                    {recipient.companion ? " (companion)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={buttonClass}
              disabled={
                !giveTo ||
                !Number.isInteger(giveAmount) ||
                giveAmount < 1 ||
                giveAmount > item.quantity
              }
              onClick={() => {
                onGive(item.id, giveTo, giveAmount);
                dialog.current?.close();
              }}
            >
              Give
            </button>
          </fieldset>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4 dark:border-stone-700">
          {item.quantity > 1 && (
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 text-sm">
                Split off
                <input
                  ref={splitInput}
                  type="number"
                  min={1}
                  max={item.quantity - 1}
                  value={split}
                  onChange={(event) => setSplit(Number(event.target.value))}
                  className={`${inputClass} w-16`}
                />
              </label>
              <button
                type="button"
                className={buttonClass}
                disabled={!Number.isInteger(split) || split < 1 || split >= item.quantity}
                onClick={() => {
                  onChange({
                    type: "split",
                    id: item.id,
                    amount: split,
                    newId: newId(),
                  });
                  dialog.current?.close();
                }}
              >
                Split
              </button>
            </div>
          )}
          <button
            type="button"
            className={`${buttonClass} ml-auto text-rose-700 dark:text-rose-400`}
            onClick={() => {
              onChange({ type: "remove", id: item.id });
              dialog.current?.close();
            }}
          >
            Remove
          </button>
          <button type="button" className={buttonClass} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
