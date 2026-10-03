/**
 * The DM's fog tools on an open map: changes show at once, save in the background, and undo and
 * redo, like an open character sheet (decision 30). Plain TypeScript, so it can be tested without
 * a browser; React reads it through `useFogEditor`.
 */
import { applyFogChange, inverseOf } from "./changes";
import { decodeCells } from "./mask";
import type { FogChange, FogMask, FogView } from "./types";

export type FogSaveStatus =
  | { kind: "saved" }
  | { kind: "saving" }
  /** `retrying`: the server couldn't be reached, and it will try again by itself. */
  | { kind: "error"; message: string; retrying: boolean };

export interface FogSnapshot {
  /** What the DM sees: the server's last copy with every unsaved change on top. */
  mask: FogMask;
  status: FogSaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  unsaved: boolean;
}

export interface FogTiming {
  /** Wait this long after a change before sending, so a burst of changes goes as one. */
  saveDelayMs: number;
  retryDelayMs: number;
}

const DEFAULT_TIMING: FogTiming = { saveDelayMs: 150, retryDelayMs: 3000 };
const UNDO_LIMIT = 100;

export function fogMask(view: FogView): FogMask {
  const cells = decodeCells(view.cells, view.cols * view.rows);
  if (!cells) throw new Error("The fog's cells don't match its grid");
  return { cols: view.cols, rows: view.rows, cells };
}

export class FogEditor {
  /** The fog as the server last said it was. */
  private confirmed: FogMask;
  /** Sent and waiting for the server's answer. */
  private sending: FogChange[] = [];
  /** Made since, not sent yet. */
  private queued: FogChange[] = [];
  /** Each step is the change that undoes one of the DM's changes (or redoes an undone one). */
  private undoStack: FogChange[] = [];
  private redoStack: FogChange[] = [];
  private status: FogSaveStatus = { kind: "saved" };
  private snapshot: FogSnapshot;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;
  private disposed = false;

  constructor(
    initial: FogView,
    /** The map's fog endpoint. */
    private readonly url: string,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
    private readonly timing: FogTiming = DEFAULT_TIMING,
  ) {
    this.confirmed = fogMask(initial);
    this.snapshot = this.makeSnapshot(this.confirmed);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Reveals or hides something: shown at once, saved shortly, undoable. */
  change(change: FogChange) {
    const redo = this.redoStack;
    this.redoStack = [];
    if (!this.record(change, this.undoStack)) this.redoStack = redo;
  }

  undo() {
    const step = this.undoStack.pop();
    if (step) this.record(step, this.redoStack);
  }

  redo() {
    const step = this.redoStack.pop();
    if (step) this.record(step, this.undoStack);
  }

  /** Saves now rather than after the usual pause, e.g. when leaving the page. */
  flush() {
    clearTimeout(this.timer);
    void this.send();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  /**
   * Applies a change on top of what's shown, and remembers what undoes it on `stack`. False if it
   * changed nothing, in which case it's neither saved nor remembered.
   */
  private record(change: FogChange, stack: FogChange[]): boolean {
    const { mask, changed } = applyFogChange(this.snapshot.mask, change);
    const inverse = inverseOf(change, changed);
    if (!inverse) return false;
    stack.push(inverse);
    if (stack.length > UNDO_LIMIT) stack.shift();
    this.queued.push(change);
    // Never "saved" while anything is waiting to be; a retry keeps saying it's retrying.
    if (this.status.kind !== "error" || !this.status.retrying) this.status = { kind: "saving" };
    this.update(mask);
    this.schedule(this.timing.saveDelayMs);
    return true;
  }

  private schedule(delay: number) {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.send(), delay);
  }

  /** Sends the next batch, or waits for the one on its way. */
  private send(): Promise<void> {
    if (!this.inFlight) {
      this.inFlight = this.sendBatch().finally(() => (this.inFlight = undefined));
    }
    return this.inFlight;
  }

  private async sendBatch() {
    if (this.sending.length > 0 || this.queued.length === 0 || this.disposed) return;
    this.sending = this.queued;
    this.queued = [];
    this.status = { kind: "saving" };
    this.update(this.snapshot.mask);

    let response: Response | undefined;
    try {
      response = await this.fetcher(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ changes: this.sending }),
      });
    } catch {
      response = undefined;
    }

    if (response && !response.ok && response.status < 500) {
      // Refused: let those changes go, and show what the server has kept. Undo steps were made
      // against what was showing, so they go too.
      this.sending = [];
      this.undoStack = [];
      this.redoStack = [];
      this.status = {
        kind: "error",
        message: (await errorOf(response)) ?? "Those fog changes couldn't be saved.",
        retrying: false,
      };
      this.update(this.withUnsaved());
      return;
    }

    const fog = response?.ok ? await fogOf(response) : undefined;
    if (!fog) {
      // Offline for a moment, or the server failed: send the same changes again, before
      // anything made since.
      this.queued = [...this.sending, ...this.queued];
      this.sending = [];
      this.status = {
        kind: "error",
        message: "Couldn't reach Guildhall. Trying again…",
        retrying: true,
      };
      this.update(this.snapshot.mask);
      this.schedule(this.timing.retryDelayMs);
      return;
    }

    // The server's copy includes this batch and anything changed elsewhere since.
    this.confirmed = fogMask(fog);
    this.sending = [];
    this.status = this.queued.length > 0 ? { kind: "saving" } : { kind: "saved" };
    this.update(this.withUnsaved());
    if (this.queued.length > 0) this.schedule(0);
  }

  /** The server's copy with every unsaved change on top. */
  private withUnsaved(): FogMask {
    return [...this.sending, ...this.queued].reduce(
      (mask, change) => applyFogChange(mask, change).mask,
      this.confirmed,
    );
  }

  private update(mask: FogMask) {
    this.snapshot = this.makeSnapshot(mask);
    for (const listener of this.listeners) listener();
  }

  private makeSnapshot(mask: FogMask): FogSnapshot {
    return {
      mask,
      status: this.status,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      unsaved: this.sending.length > 0 || this.queued.length > 0,
    };
  }
}

/** The fog in a successful answer; undefined if the answer can't be read. */
async function fogOf(response: Response): Promise<FogView | undefined> {
  try {
    const body = (await response.json()) as { fog?: FogView };
    fogMask(body.fog!);
    return body.fog;
  } catch {
    return undefined;
  }
}

async function errorOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}
