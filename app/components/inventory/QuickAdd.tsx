import { useId, useRef, useState, type KeyboardEvent } from "react";
import { DESCRIPTION_MAX, SOURCE_MAX } from "~/characters/inventory-changes";
import { guessIcon, parseQuickAdd } from "~/characters/quick-add";
import type { InventoryItem, ItemSource } from "~/characters/types";
import type { CatalogueItem } from "~/characters/view";
import { newId } from "~/shared/ids";
import { buttonClass, inputClass, primaryButtonClass } from "../styles";
import { ItemIconSvg } from "./ItemTile";

type Option = { kind: "custom" } | { kind: "vault"; item: CatalogueItem };

const MAX_SUGGESTIONS = 6;

/**
 * Adding mid-session in a few keystrokes: type "3 rope", press Enter. Suggestions are vault item
 * notes first when one matches exactly, then the typed text as a custom item. It stays open for
 * the next item, so a whole haul can go in quickly; description and source are optional, and the
 * source is remembered between items.
 */
export function QuickAdd({
  catalogue,
  onAdd,
  onClose,
  label = "Add item",
}: {
  catalogue: CatalogueItem[];
  onAdd: (item: InventoryItem) => void;
  onClose: () => void;
  label?: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [details, setDetails] = useState(false);
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const parsed = parseQuickAdd(text);
  const options = parsed ? optionsFor(parsed.name, catalogue) : [];

  function add(option: Option | undefined) {
    if (!parsed || !option) return;
    const sourceText = source.trim();
    const itemSource: ItemSource | undefined = sourceText ? { text: sourceText } : undefined;
    const name = option.kind === "vault" ? option.item.title : parsed.name;
    onAdd({
      id: newId(),
      name,
      icon: {
        builtin: option.kind === "vault" ? (option.item.icon ?? guessIcon(name)) : guessIcon(name),
      },
      quantity: parsed.quantity,
      equipped: false,
      attuned: false,
      ...(option.kind === "vault" ? { note: option.item.id } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(itemSource ? { source: itemSource } : {}),
    });
    setText("");
    setDescription("");
    setActive(0);
    input.current?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && options.length > 0) {
      setActive((active + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length > 0) {
      setActive((active - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      add(options[active]);
    } else if (event.key === "Escape") {
      onClose();
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <div className="mb-4 rounded-lg border border-trim bg-accent-surface/60 p-3">
      <div className="flex gap-2">
        <input
          ref={input}
          autoFocus
          role="combobox"
          aria-label={label}
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
          placeholder='What is it? e.g. "3 torches"'
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKey}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!parsed}
          onClick={() => add(options[active])}
        >
          Add
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          Done
        </button>
      </div>
      {options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="mt-2 overflow-hidden rounded-md border border-line bg-surface"
        >
          {options.map((option, index) => {
            const name = option.kind === "vault" ? option.item.title : parsed!.name;
            const icon =
              option.kind === "vault" ? (option.item.icon ?? guessIcon(name)) : guessIcon(name);
            return (
              <li
                key={option.kind === "vault" ? option.item.id : "custom"}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(option)}
                className={[
                  "flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm",
                  index === active ? "bg-accent-surface" : "hover:bg-raised",
                ].join(" ")}
              >
                <ItemIconSvg icon={{ builtin: icon }} className="h-5 w-5 shrink-0" />
                {option.kind === "vault" ? (
                  <span>
                    {parsed!.quantity > 1 && `${parsed!.quantity} × `}
                    {name} <span className="text-xs text-muted">· from the wiki</span>
                    {option.item.hiddenFromPlayers && (
                      <span className="ml-1 text-xs text-danger">
                        · players can&rsquo;t read its note yet, so they&rsquo;ll see only this name
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    Add{" "}
                    <strong>
                      {parsed!.quantity > 1 && `${parsed!.quantity} × `}
                      {name}
                    </strong>{" "}
                    <span className="text-xs text-muted">· your own item</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        aria-expanded={details}
        onClick={() => setDetails(!details)}
        className="mt-2 text-sm text-muted underline-offset-2 hover:underline"
      >
        {details ? "Hide details" : "Add a description or where it came from"}
      </button>
      {details && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-muted">Description</span>
            <input
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClass} w-full`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted">
              Came from <span className="text-xs">(kept for the next item)</span>
            </span>
            <input
              value={source}
              maxLength={SOURCE_MAX}
              placeholder="e.g. the old mill, Session 3"
              onChange={(event) => setSource(event.target.value)}
              className={`${inputClass} w-full`}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function optionsFor(name: string, catalogue: CatalogueItem[]): Option[] {
  const query = name.toLowerCase();
  const matches = catalogue.filter((item) => item.title.toLowerCase().includes(query));
  const exact = matches.filter((item) => item.title.toLowerCase() === query);
  const others = matches.filter((item) => !exact.includes(item));
  const custom: Option = { kind: "custom" };
  return [
    ...exact.map((item): Option => ({ kind: "vault", item })),
    custom,
    ...others.map((item): Option => ({ kind: "vault", item })),
  ].slice(0, MAX_SUGGESTIONS);
}
