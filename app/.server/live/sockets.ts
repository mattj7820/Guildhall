import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { Viewer } from "~/campaign/types";
import { LIVE_PATH } from "~/live/messages";
import type { Services } from "~/context";
import type { Account } from "../auth/account";
import { identify } from "../auth/identify";
import { isOwnSocketOrigin } from "../auth/origin";

/** Small JSON messages only: anything bigger is refused before it's read. */
const MAX_MESSAGE_BYTES = 4096;

/** Someone let in to open a live connection, and what they may see. */
export interface Admitted {
  account: Extract<Account, { kind: "member" }>;
  viewer: Viewer;
}

export type Admission = Admitted | { refused: 401 | 403 };

type Deps = Pick<Services, "sessions" | "members" | "config">;

/**
 * Whether a live connection may open: it must come from Guildhall's own pages, and from someone
 * signed in and let in, checked exactly as for a page.
 */
export async function admit(request: Request, services: Deps): Promise<Admission> {
  if (!isOwnSocketOrigin(request, services.config)) return { refused: 403 };
  const { account, viewer } = await identify(request, services);
  if (account.kind === "anonymous") return { refused: 401 };
  if (account.kind !== "member" || !viewer) return { refused: 403 };
  return { account, viewer };
}

/** The upgrade request as a fetch `Request`, so the sign-in code can read it like any other. */
export function toRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const each of [value ?? []].flat()) headers.append(name, each);
  }
  return new Request(new URL(req.url ?? "/", `http://${req.headers.host}`), { headers });
}

/**
 * Websockets on the same HTTP server as the pages. The server hands over every upgrade request;
 * only signed-in members get a connection, which is then passed on with who they are.
 */
export class LiveSockets {
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });

  constructor(
    private readonly services: Deps,
    private readonly onConnection: (socket: WebSocket, who: Admitted) => void,
  ) {}

  async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const request = toRequest(req);
      if (new URL(request.url).pathname !== LIVE_PATH) return refuse(socket, 404);
      const admission = await admit(request, this.services);
      if ("refused" in admission) return refuse(socket, admission.refused);
      this.server.handleUpgrade(req, socket, head, (connection) =>
        this.onConnection(connection, admission),
      );
    } catch {
      refuse(socket, 400);
    }
  }

  /** Closes every connection with "restarting", so browsers reconnect rather than give up. */
  close(): void {
    for (const client of this.server.clients) client.close(1012, "Restarting");
    this.server.close();
  }
}

const REASONS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
};

function refuse(socket: Duplex, status: number): void {
  if (socket.writable) {
    socket.write(`HTTP/1.1 ${status} ${REASONS[status]}\r\nConnection: close\r\n\r\n`);
  }
  socket.destroy();
}
