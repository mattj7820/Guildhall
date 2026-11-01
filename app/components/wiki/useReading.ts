import { useCallback, useSyncExternalStore } from "react";

/**
 * Reading mode: the tome's left page folded away so a long note has the book's whole width. Each
 * person's own, kept in their browser (it's how they like to read on that screen), and off on
 * the server, so the page first draws as the open book.
 */
const KEY = "guildhall.tome.reading";
const listeners = new Set<() => void>();
// Where it's kept when the browser won't store anything: for this visit only.
let unstored = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return unstored;
  }
}

export function useReading(): [boolean, (on: boolean) => void] {
  const reading = useSyncExternalStore(subscribe, stored, () => false);
  const setReading = useCallback((on: boolean) => {
    unstored = on;
    try {
      if (on) localStorage.setItem(KEY, "on");
      else localStorage.removeItem(KEY);
    } catch {
      // Not remembered, but still changed for this visit.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [reading, setReading];
}
