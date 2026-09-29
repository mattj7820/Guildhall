import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouteLoaderData } from "react-router";
import type { MapId } from "~/maps/types";
import type { loader as rootLoader } from "~/root";
import { LiveClient, type LiveStatus } from "./client";
import { LIVE_PATH, type ServerMessage } from "./messages";

let shared: LiveClient | undefined;

/** The tab's one live connection, made when first needed. */
function liveClient(): LiveClient {
  shared ??= new LiveClient(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${LIVE_PATH}`,
  );
  return shared;
}

/**
 * Hears what the server says about a map while the component is showing it, and returns whether
 * the connection is live. Pages rendered on the server start as "connecting".
 */
export function useLiveMap(map: MapId, onMessage: (message: ServerMessage) => void): LiveStatus {
  const latest = useRef(onMessage);
  useEffect(() => {
    latest.current = onMessage;
  });
  // What the DM previews as: when it changes, the connection signs in again as the new view.
  const viewer = useRouteLoaderData<typeof rootLoader>("root")?.role ?? "none";
  useEffect(() => liveClient().setViewer(viewer), [viewer]);
  useEffect(() => liveClient().watch(map, (message) => latest.current(message)), [map]);
  return useSyncExternalStore(
    (changed) => liveClient().onStatus(changed),
    () => liveClient().getStatus(),
    () => "connecting",
  );
}
