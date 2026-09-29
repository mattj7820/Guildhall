import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

/** How often an open map checks for changes: often enough that a reveal shows within seconds. */
export const MAP_POLL_MS = 3000;

/**
 * Keeps an open map up to date without reloading the page: checks the map's version while the tab
 * is visible, and as soon as it's shown or focused again, and reloads the page's data only when
 * the version has changed (or the map is no longer there). Later, a websocket can say the same
 * thing sooner; only what triggers the check would change.
 */
export function useMapUpdates(versionUrl: string, version: string) {
  const { revalidate, state } = useRevalidator();
  const latest = useRef({ version, revalidate, idle: state === "idle" });
  useEffect(() => {
    latest.current = { version, revalidate, idle: state === "idle" };
  });

  useEffect(() => {
    let checking = false;
    async function check() {
      if (checking || document.visibilityState !== "visible" || !latest.current.idle) return;
      checking = true;
      try {
        const response = await fetch(versionUrl, { headers: { Accept: "application/json" } });
        // Gone or no longer shared: reloading shows the not-found page.
        if (response.status === 404) return void latest.current.revalidate();
        if (!response.ok) return;
        const { version: now } = (await response.json()) as { version: string };
        if (now !== latest.current.version) void latest.current.revalidate();
      } catch {
        // Offline for a moment: the next check will try again.
      } finally {
        checking = false;
      }
    }
    const timer = setInterval(check, MAP_POLL_MS);
    const onShown = () => void check();
    window.addEventListener("focus", onShown);
    document.addEventListener("visibilitychange", onShown);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onShown);
      document.removeEventListener("visibilitychange", onShown);
    };
  }, [versionUrl]);
}
