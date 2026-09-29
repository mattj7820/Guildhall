import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveClient, reconnectDelay, type SocketLike } from "./client";
import type { ServerMessage } from "./messages";

/** Stands in for a browser's WebSocket: a test opens, closes and talks to it by hand. */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: unknown[] = [];
  closedByClient = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closedByClient = true;
    this.readyState = 3;
  }
  opens() {
    this.readyState = 1;
    this.onopen?.();
  }
  says(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drops(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

let sockets: FakeSocket[];
let client: LiveClient;
const latest = () => sockets.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  client = new LiveClient("ws://guildhall.test/live", {
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    random: () => 0.5,
  });
});

afterEach(() => vi.useRealTimers());

describe("reconnectDelay", () => {
  it.each([
    [0, 1000],
    [1, 2000],
    [2, 5000],
    [3, 10_000],
    [50, 10_000],
  ])("waits about %s → %s ms", (attempt, expected) => {
    expect(reconnectDelay(attempt, () => 0.5)).toBe(expected);
  });

  it("spreads reconnections out by a fifth either way", () => {
    expect(reconnectDelay(0, () => 0)).toBe(800);
    expect(reconnectDelay(0, () => 1)).toBe(1200);
  });
});

describe("LiveClient", () => {
  it("opens only once something watches, and watches the map when it opens", () => {
    expect(sockets).toHaveLength(0);
    client.watch("m", () => {});
    expect(client.getStatus()).toBe("connecting");
    latest().opens();
    expect(client.getStatus()).toBe("live");
    expect(latest().sent).toEqual([{ type: "watch", map: "m" }]);
  });

  it("hands each message to those watching its map", () => {
    const [heardM, heardN] = [vi.fn(), vi.fn()];
    client.watch("m", heardM);
    client.watch("n", heardN);
    latest().opens();
    latest().says({ type: "map", map: "m", version: "v2" });
    expect(heardM).toHaveBeenCalledWith({ type: "map", map: "m", version: "v2" });
    expect(heardN).not.toHaveBeenCalled();
  });

  it("shares one connection, and watches a map once however many are listening", () => {
    client.watch("m", () => {});
    latest().opens();
    const stop = client.watch("m", () => {});
    expect(sockets).toHaveLength(1);
    expect(latest().sent).toEqual([{ type: "watch", map: "m" }]);
    stop();
    expect(latest().sent).toHaveLength(1);
  });

  it("unwatches a map nobody's listening to, and closes once nothing is watched", () => {
    const stopM = client.watch("m", () => {});
    const stopN = client.watch("n", () => {});
    latest().opens();
    stopM();
    expect(latest().sent.at(-1)).toEqual({ type: "unwatch", map: "m" });
    stopN();
    expect(latest().closedByClient).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("reconnects after a drop, waiting longer each time, and watches everything again", () => {
    const statuses: string[] = [];
    client.onStatus(() => statuses.push(client.getStatus()));
    client.watch("m", () => {});
    latest().opens();
    latest().drops();
    expect(client.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    latest().drops(); // refused, perhaps: the server's restarting
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    latest().opens();
    expect(latest().sent).toEqual([{ type: "watch", map: "m" }]);
    expect(statuses).toEqual(["live", "reconnecting", "live"]);
  });

  it("starts waiting from the shortest time again once it has reconnected", () => {
    client.watch("m", () => {});
    for (const wait of [0, 1000, 2000]) {
      vi.advanceTimersByTime(wait);
      latest().drops();
    }
    vi.advanceTimersByTime(5000);
    latest().opens();
    latest().drops();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(5);
  });

  it("reconnects at once when the server says their access changed", () => {
    client.watch("m", () => {});
    latest().opens();
    latest().drops(4000);
    vi.advanceTimersByTime(0);
    expect(sockets).toHaveLength(2);
  });

  it("reopens as someone else when the viewer changes, but not for the same viewer", () => {
    client.setViewer("dm");
    client.watch("m", () => {});
    latest().opens();
    client.setViewer("dm");
    expect(sockets).toHaveLength(1);
    client.setViewer("player");
    expect(sockets[0].closedByClient).toBe(true);
    expect(sockets).toHaveLength(2);
  });

  it("ignores messages that can't be read", () => {
    const heard = vi.fn();
    client.watch("m", heard);
    latest().opens();
    latest().onmessage?.({ data: "not json" });
    expect(heard).not.toHaveBeenCalled();
  });
});
