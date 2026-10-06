import { useSyncExternalStore, type ReactNode } from "react";
import { iconButtonClass } from "../styles";

export interface SidePanelTab<T extends string> {
  key: T;
  label: string;
  /** Shown when the panel is folded away. */
  icon: string;
  /** A key that opens it, said in its title. */
  shortcut?: string;
}

/**
 * A side panel beside the map, in tabs: one fixed width whatever's open, so the map doesn't jump
 * (decision 64), folding away to a strip of icons for more map. The players' panel and the DM's
 * share it.
 */
export function SidePanel<T extends string>({
  label,
  tabs,
  tab,
  folded,
  onOpen,
  onFold,
  extra,
  children,
}: {
  /** The panel's accessible name. */
  label: string;
  tabs: readonly SidePanelTab<T>[];
  tab: T;
  folded: boolean;
  onOpen: (tab: T) => void;
  onFold: () => void;
  /** Beside the tabs, such as whose sheet. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  if (folded) {
    return (
      <nav
        aria-label={label}
        className="flex flex-row gap-1 border-stone-200 p-1 md:flex-col md:border-l dark:border-stone-800"
      >
        {tabs.map(({ key, label: name, icon, shortcut }) => (
          <button
            key={key}
            type="button"
            aria-label={name}
            title={shortcut ? `${name} (${shortcut})` : name}
            onClick={() => onOpen(key)}
            className="h-10 w-10 rounded text-lg hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            {icon}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside
      aria-label={label}
      className="flex w-full flex-col border-stone-200 md:w-[27rem] md:shrink-0 md:border-l dark:border-stone-800"
    >
      <div className="flex items-center gap-1 border-b border-stone-200 px-2 pt-2 dark:border-stone-800">
        <div role="tablist" aria-label={label} className="flex gap-1">
          {tabs.map(({ key, label: name, shortcut }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              title={shortcut ? `${name} (${shortcut})` : undefined}
              onClick={() => onOpen(key)}
              className={`rounded-t-md px-3 py-1.5 text-sm ${
                tab === key
                  ? "-mb-px border border-b-0 border-stone-200 bg-white font-semibold dark:border-stone-800 dark:bg-stone-900"
                  : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {extra}
        <button
          type="button"
          aria-label="Fold the panel away"
          title="Fold away"
          className={`${iconButtonClass} mb-1 ml-auto`}
          onClick={onFold}
        >
          ⇥
        </button>
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
}

export interface PanelState<T extends string> {
  tab: T;
  folded: boolean;
}

/**
 * What's open in a panel, kept in the browser under `key`, so it stays open from one map to the
 * next and across a reload: `first` on the server and while hydrating, then what was open last.
 * If storage is blocked, it's kept for this page only.
 */
export function rememberedPanel<T extends string>(key: string, tabs: readonly T[], first: T) {
  const FIRST: PanelState<T> = { tab: first, folded: false };
  const listeners = new Set<() => void>();
  let pageOnly: PanelState<T> | undefined;
  let last: { saved: string | null; state: PanelState<T> } | undefined;

  function parse(saved: string | null): PanelState<T> {
    try {
      const value = JSON.parse(saved ?? "null");
      if (tabs.includes(value?.tab) && typeof value.folded === "boolean") {
        return { tab: value.tab, folded: value.folded };
      }
    } catch {
      // Damaged: start again.
    }
    return FIRST;
  }

  function current(): PanelState<T> {
    if (pageOnly) return pageOnly;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      // Storage blocked: as at first.
    }
    if (!last || last.saved !== saved) last = { saved, state: parse(saved) };
    return last.state;
  }

  function remember(next: PanelState<T>) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      pageOnly = undefined;
    } catch {
      pageOnly = next;
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    current,
    remember,
    /** The panel's state, kept in step with every other use of it on the page. */
    use: () => useSyncExternalStore(subscribe, current, () => FIRST),
  };
}
