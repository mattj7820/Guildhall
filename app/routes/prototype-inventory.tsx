/**
 * A throwaway, clickable prototype of the inventory with made-up items, to try the feel before
 * the real model and saving exist. Nothing is saved. DM only. Removed once the real bag is built.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { data, Link, useSearchParams } from "react-router";
import {
  applyInventoryChange,
  describeChange,
  type InventoryChange,
  type InventoryState,
} from "~/characters/inventory-changes";
import type { InventoryItem } from "~/characters/types";
import { Bag } from "~/components/inventory/Bag";
import type { LinkedNote } from "~/components/inventory/ItemDetails";
import type { CatalogueItem } from "~/components/inventory/QuickAdd";
import { UndoToast } from "~/components/inventory/UndoToast";
import { buttonClass, panelClass, primaryButtonClass } from "~/components/styles";
import { viewerContext } from "~/context";
import { record, redo, startHistory, undo, type History } from "~/shared/history";
import type { Route } from "./+types/prototype-inventory";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Inventory prototype · Guildhall" }];
}

export function loader({ context }: Route.LoaderArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  return null;
}

function item(fields: Partial<InventoryItem> & Pick<InventoryItem, "id" | "name">): InventoryItem {
  return { icon: { builtin: "bag" }, quantity: 1, equipped: false, attuned: false, ...fields };
}

const START: InventoryState = {
  items: [
    item({ id: "p1", name: "Dagger", icon: { builtin: "dagger" }, equipped: true }),
    item({ id: "p2", name: "Leather armour", icon: { builtin: "leather-armour" }, equipped: true }),
    item({ id: "p3", name: "Shortbow", icon: { builtin: "bow" } }),
    item({ id: "p4", name: "Arrows", icon: { builtin: "arrows" }, quantity: 20 }),
    item({ id: "p5", name: "Torch", icon: { builtin: "torch" }, quantity: 3 }),
    item({ id: "p6", name: "Torch", icon: { builtin: "torch" }, quantity: 2 }),
    item({
      id: "p7",
      name: "Rope",
      icon: { builtin: "rope" },
      description: "Prototype: a custom item with a short description.",
    }),
    item({ id: "p8", name: "Rations", icon: { builtin: "bread" }, quantity: 4 }),
    item({
      id: "p9",
      name: "Sample potion",
      icon: { builtin: "potion" },
      quantity: 2,
      note: "sample-potion",
      source: { text: "Prototype: a place, Session 1" },
    }),
    item({
      id: "p10",
      name: "Sample ring",
      icon: { builtin: "ring" },
      note: "sample-ring",
      givenByDm: true,
      unseen: true,
      source: { text: "From the DM" },
    }),
    item({ id: "p11", name: "Gem", icon: { builtin: "gem" }, quantity: 2 }),
  ],
  purse: { cp: 13, sp: 7, ep: 0, gp: 42, pp: 0 },
};

const CATALOGUE: CatalogueItem[] = [
  { id: "sample-potion", title: "Sample potion", icon: "potion" },
  { id: "sample-ring", title: "Sample ring", icon: "ring" },
  { id: "sample-letter", title: "Sample letter", icon: "letter" },
];

const NOTE_HTML =
  "<p>Prototype: the shared text of a vault item note appears here.</p>" +
  '<div class="dm-section"><p>Prototype: a DM section. The DM sees it boxed; players never get it.</p></div>';

const NOTES: Record<string, LinkedNote> = Object.fromEntries(
  CATALOGUE.map(({ id, title }) => [id, { title, html: NOTE_HTML, url: "/wiki" }]),
);

type Layout = "bag" | "tab";

export default function InventoryPrototype() {
  const [params, setParams] = useSearchParams();
  const layout: Layout = params.get("layout") === "tab" ? "tab" : "bag";
  const bagOpen = layout === "tab" || params.has("bag");

  const [history, setHistoryState] = useState<History<InventoryState>>(() => startHistory(START));
  const [toast, setToast] = useState<{ message?: string; serial: number }>({ serial: 0 });
  // Read the latest history here, not in a state updater, which may run twice.
  const latest = useRef(history);
  const setHistory = useCallback((next: History<InventoryState>) => {
    latest.current = next;
    setHistoryState(next);
  }, []);

  const change = useCallback(
    (next: InventoryChange) => {
      const current = latest.current;
      const after = applyInventoryChange(current.present, next);
      if (after === current.present) return;
      setHistory(record(current, after));
      if (next.type !== "seen") {
        const message = describeChange(current.present, next);
        setToast((previous) => ({ message, serial: previous.serial + 1 }));
      }
    },
    [setHistory],
  );

  const undoLast = useCallback(() => setHistory(undo(latest.current)), [setHistory]);

  // Ctrl+Z / Ctrl+Shift+Z, except while typing, where the text box's own undo should win. I opens
  // and closes the bag, as in games.
  const bagButton = useRef<HTMLButtonElement>(null);
  const setBag = useCallback(
    (open: boolean) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (open) next.set("bag", "");
          else next.delete("bag");
          return next;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        setHistory((event.shiftKey ? redo : undo)(latest.current));
      } else if (
        key === "i" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        layout === "bag"
      ) {
        setBag(!bagOpen);
        if (bagOpen) bagButton.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bagOpen, layout, setBag, setHistory]);

  const bag = <Bag state={history.present} onChange={change} catalogue={CATALOGUE} notes={NOTES} />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
        <strong>Inventory prototype</strong>
        <span>Made-up items; nothing is saved.</span>
        <span className="ml-auto flex items-center gap-2">
          Layout:
          <Link
            to="?layout=bag&bag"
            aria-current={layout === "bag" ? "page" : undefined}
            className={layout === "bag" ? primaryButtonClass : buttonClass}
          >
            Bag over the sheet
          </Link>
          <Link
            to="?layout=tab"
            aria-current={layout === "tab" ? "page" : undefined}
            className={layout === "tab" ? primaryButtonClass : buttonClass}
          >
            Inventory tab
          </Link>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setHistory(startHistory(START))}
          >
            Reset
          </button>
        </span>
      </div>

      {layout === "bag" ? (
        <div className={bagOpen ? "lg:grid lg:grid-cols-[1fr_30rem] lg:gap-6" : ""}>
          <SheetStandIn
            actions={
              <button
                ref={bagButton}
                type="button"
                aria-expanded={bagOpen}
                aria-controls="bag-panel"
                onClick={() => setBag(!bagOpen)}
                className={primaryButtonClass}
              >
                {bagOpen ? "Close bag" : "Bag"} <kbd className="ml-1 text-xs opacity-70">I</kbd>
              </button>
            }
          />
          {bagOpen && (
            <section
              id="bag-panel"
              aria-labelledby="bag-heading"
              className={`${panelClass} fixed inset-0 z-30 overflow-y-auto rounded-none lg:static lg:rounded-lg`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id="bag-heading" tabIndex={-1} className="font-serif text-2xl font-bold">
                  Bag
                </h2>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setBag(false);
                    bagButton.current?.focus();
                  }}
                >
                  <span className="lg:hidden">Back to sheet</span>
                  <span className="hidden lg:inline">Close</span>
                </button>
              </div>
              {bag}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <SheetStandIn />
          <section className={panelClass} aria-labelledby="tabs-heading">
            <h2 id="tabs-heading" className="sr-only">
              Sheet tabs
            </h2>
            <div className="mb-4 flex gap-4 border-b border-stone-200 text-sm dark:border-stone-700">
              {["Equipped", "Inventory", "Features & notes", "Story"].map((tab) => (
                <span
                  key={tab}
                  className={
                    tab === "Inventory"
                      ? "-mb-px border-b-2 border-amber-600 pb-2 font-semibold"
                      : "pb-2 text-stone-400"
                  }
                >
                  {tab}
                </span>
              ))}
            </div>
            {bag}
          </section>
        </div>
      )}

      <UndoToast message={toast.message} serial={toast.serial} onUndo={undoLast} />
    </main>
  );
}

/** Just enough of a character sheet to judge the layouts around it. */
function SheetStandIn({ actions }: { actions?: React.ReactNode }) {
  const abilities = [
    ["STR", "+1", 12],
    ["DEX", "+3", 16],
    ["CON", "+2", 14],
    ["INT", "+0", 10],
    ["WIS", "+1", 12],
    ["CHA", "−1", 8],
  ] as const;
  return (
    <section className={`${panelClass} mb-4 lg:mb-0`} aria-label="Character sheet (stand-in)">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-stone-200 dark:bg-stone-800" aria-hidden="true" />
        <div className="mr-auto">
          <h1 className="font-serif text-3xl font-bold">Prototype character</h1>
          <p className="text-sm text-stone-500">Species · Class 3 · the real sheet comes later</p>
        </div>
        {actions}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {abilities.map(([name, modifier, score]) => (
          <div
            key={name}
            className="rounded-lg border border-stone-200 p-2 text-center dark:border-stone-700"
          >
            <div className="text-xs font-semibold text-stone-500">{name}</div>
            <div className="text-2xl font-bold">{modifier}</div>
            <div className="text-xs text-stone-500">{score}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-sm text-stone-400 sm:grid-cols-3">
        <div className="h-40 rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">Saving throws</div>
        <div className="h-40 rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">Skills</div>
        <div className="h-40 rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">
          AC · Initiative · HP
        </div>
      </div>
    </section>
  );
}
