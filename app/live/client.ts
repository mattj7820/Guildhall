/**
 * The browser's end of the live connection: one per tab, opened while anything is watching,
 * shared by everything on the page, and reopened when it drops. Browser only.
 */
import type { MapId } from "~/maps/types";
import {
  CLOSE_ACCESS_CHANGED,
  CLOSE_CAMPAIGN_CHANGED,
  type ClientMessage,
  type ServerMessage,
} from "./messages";

export type LiveStatus = "connecting" | "live" | "reconnecting";

/** The parts of a `WebSocket` the client uses, so tests can stand in for one. */
export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  send(text: string): void;
  close(): void;
}

const OPEN = 1;

/** Waits before reconnecting: 1, 2, 5, then every 10 seconds, give or take a fifth. */
const DELAYS_MS = [1000, 2000, 5000, 10_000];

export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const base = DELAYS_MS[Math.min(attempt, DELAYS_MS.length - 1)];
  // Spread out, so everyone's browsers don't all come back at once after a restart.
  return Math.round(base * (0.8 + random() * 0.4));
}

type Listener = (message: ServerMessage) => void;

interface Options {
  createSocket?: (url: string) => SocketLike;
  random?: () => number;
  /** The DM switched campaigns: the page shows another campaign's things, so it loads afresh. */
  reload?: () => void;
}

export class LiveClient {
  private socket?: SocketLike;
  private status: LiveStatus = "connecting";
  private attempt = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private viewer?: string;
  private readonly maps = new Map<MapId, Set<Listener>>();
  private readonly statusListeners = new Set<() => void>();
  private readonly createSocket: (url: string) => SocketLike;
  private readonly random: () => number;
  private readonly reload: () => void;

  constructor(
    private readonly url: string,
    {
      // A browser WebSocket's handlers take full events; the client only reads `data` and `code`.
      createSocket = (url) => new WebSocket(url) as unknown as SocketLike,
      random = Math.random,
      reload = () => location.reload(),
    }: Options = {},
  ) {
    this.createSocket = createSocket;
    this.random = random;
    this.reload = reload;
  }

  getStatus(): LiveStatus {
    return this.status;
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Hears what the server says about a map, while it's open. Returns a way to stop. */
  watch(map: MapId, listener: Listener): () => void {
    let listeners = this.maps.get(map);
    if (!listeners) {
      listeners = new Set();
      this.maps.set(map, listeners);
      this.send({ type: "watch", map });
    }
    listeners.add(listener);
    if (!this.socket) this.open();
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0 || this.maps.get(map) !== listeners) return;
      this.maps.delete(map);
      this.send({ type: "unwatch", map });
      if (this.maps.size === 0) this.stop();
    };
  }

  /**
   * Who the page says is looking. A live connection is signed in once, when it opens, so when
   * that changes (the DM previewing as a player) it reopens as them.
   */
  setViewer(key: string): void {
    const changed = this.viewer !== undefined && this.viewer !== key;
    this.viewer = key;
    if (changed && this.socket) {
      this.stop();
      this.open();
    }
  }

  private open(): void {
    clearTimeout(this.retry);
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus("live");
      for (const map of this.maps.keys()) this.send({ type: "watch", map });
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      for (const listener of this.maps.get(message.map) ?? []) listener(message);
    };
    socket.onclose = ({ code }) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (code === CLOSE_CAMPAIGN_CHANGED) return this.reload();
      this.setStatus("reconnecting");
      // Access changed: sign in again straight away, as whoever they are now.
      if (code === CLOSE_ACCESS_CHANGED) this.attempt = 0;
      const wait = code === CLOSE_ACCESS_CHANGED ? 0 : reconnectDelay(this.attempt++, this.random);
      this.retry = setTimeout(() => this.open(), wait);
    };
  }

  /** Closes the connection and doesn't reopen it. */
  private stop(): void {
    clearTimeout(this.retry);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    this.attempt = 0;
    this.setStatus("connecting");
  }

  /** Sends if the connection is open; otherwise it's dropped (drags don't need to arrive). */
  send(message: ClientMessage): void {
    if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify(message));
  }

  private setStatus(status: LiveStatus): void {
    if (status === this.status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener();
  }
}
