import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import type { LiveStatus } from "~/live/client";
import { useLiveMap } from "~/live/useLive";
import type { MapId } from "./types";

/** How often an open map checks for changes while the live connection is down. */
export const MAP_POLL_MS = 3000;

/**
 * Keeps an open map up to date without reloading the page. The server pushes the map's version
 * over the live connection as soon as anything changes, and the page reloads its data (through
 * the same loader as the first load) only when the version differs, or the map has gone. While
 * the connection is down it checks the version every few seconds instead, and when the tab is
 * shown or focused again. Returns the connection's status.
 */
export function useMapUpdates(map: MapId, versionUrl: string, version: string): LiveStatus {
  const { revalidate, state } = useRevalidator();
  const latest = useRef({ version, revalidate, idle: state === "idle", live: false });
  const status = useLiveMap(map, (message) => {
    if (message.type === "gone") void latest.current.revalidate();
    else if (message.type === "map" && message.version !== latest.current.version) {
      void latest.current.revalidate();
    }
  });
  useEffect(() => {
    latest.current = { version, revalidate, idle: state === "idle", live: status === "live" };
  });

  useEffect(() => {
    let checking = false;
    async function check() {
      const { live, idle } = latest.current;
      if (live || checking || document.visibilityState !== "visible" || !idle) return;
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

  return status;
}
