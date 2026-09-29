/**
 * An open sheet: shows changes at once, saves them in the background, undoes and redoes them, and
 * picks up changes made elsewhere. Plain TypeScript, so it can be tested without a browser; React
 * reads it through `useCharacterEditor`.
 */
import { applyAction, type ActionResult, type CharacterAction } from "./actions";
import { replacedNotice } from "./describe";
import {
  confirmed,
  hasUnsaved,
  queue,
  refreshed,
  sendFailed,
  shown,
  startSync,
  takeBatch,
  type SyncState,
} from "./sync";
import type { Character } from "./types";
import { emptyUndo, inverseOf, remember, takeStep, type UndoStack } from "./undo";

export type SaveStatus =
  | { kind: "saved" }
  | { kind: "saving" }
  /** Retrying: the server couldn't be reached, and it will try again by itself. */
  | { kind: "error"; message: string; retrying: boolean };

export interface Notice {
  id: number;
  text: string;
}

export interface EditorSnapshot {
  character: Character;
  status: SaveStatus;
  notices: Notice[];
  canUndo: boolean;
  canRedo: boolean;
  unsaved: boolean;
}

export interface EditorTiming {
  /** Wait this long after a change before sending, so a burst of changes goes as one. */
  saveDelayMs: number;
  retryDelayMs: number;
}

const DEFAULT_TIMING: EditorTiming = { saveDelayMs: 300, retryDelayMs: 3000 };
const NOTICES_KEPT = 4;

interface SaveAnswer {
  character: Character;
  results: Omit<ActionResult, "character">[];
  changedElsewhere: boolean;
}

export class CharacterEditor {
  private sync: SyncState;
  private undoStack: UndoStack = emptyUndo;
  private status: SaveStatus = { kind: "saved" };
  private notices: Notice[] = [];
  private noticeCount = 0;
  private snapshot: EditorSnapshot;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshing = false;
  /** The save on its way, if any. */
  private inFlight: Promise<void> | undefined;
  private disposed = false;

  constructor(
    initial: Character,
    /** The character's changes endpoint: POST batches, GET the stored copy. */
    private readonly url: string,
    /** Where gifts to another bag go. */
    private readonly giveUrl: string,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
    private readonly timing: EditorTiming = DEFAULT_TIMING,
  ) {
    this.sync = startSync(initial);
    this.snapshot = this.makeSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Makes changes: shown at once, saved shortly, undoable as one step. */
  dispatch(...actions: CharacterAction[]) {
    let current = shown(this.sync);
    const inverse: CharacterAction[] = [];
    for (const action of actions) {
      inverse.unshift(...inverseOf(current, action));
      current = applyAction(current, action).character;
    }
    this.undoStack = remember(this.undoStack, inverse);
    this.sync = queue(this.sync, ...actions);
    this.changed();
    this.schedule(this.timing.saveDelayMs);
  }

  /** Makes changes that aren't worth an undo step, such as marking an item as seen. */
  dispatchWithoutUndo(...actions: CharacterAction[]) {
    this.sync = queue(this.sync, ...actions);
    this.changed();
    this.schedule(this.timing.saveDelayMs);
  }

  undo() {
    this.step("undo");
  }

  redo() {
    this.step("redo");
  }

  /** Saves now rather than after the usual pause, e.g. when leaving a field or the page. */
  flush() {
    clearTimeout(this.timer);
    void this.send();
  }

  /**
   * Fetches the stored character to pick up changes made elsewhere. Skipped while anything is
   * unsaved: the answer to that save brings them anyway.
   */
  async refresh() {
    if (this.refreshing || hasUnsaved(this.sync) || this.disposed) return;
    this.refreshing = true;
    try {
      const response = await this.fetcher(this.url, { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const { character } = (await response.json()) as { character: Character };
      const before = this.sync.confirmed.revision;
      this.sync = refreshed(this.sync, character);
      if (this.sync.confirmed.revision > before) {
        this.notify(["Updated with changes made elsewhere."]);
        this.changed();
      }
    } catch {
      // Offline for a moment: the next poll will try again.
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Gives some or all of a stack to another party member. Anything unsaved is saved first, so the
   * server has the item as it's shown here. Not an undo step: it's in someone else's bag now.
   * Resolves to a problem to show, or nothing when it's done.
   */
  async give(gift: { item: string; amount: number; to: string }): Promise<string | undefined> {
    if (!(await this.settle())) {
      return "Your other changes haven't saved yet, so nothing was given. Try again in a moment.";
    }
    let response: Response;
    try {
      response = await this.fetcher(this.giveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(gift),
      });
    } catch {
      return "Couldn't reach Guildhall. Nothing was given.";
    }
    if (!response.ok) return (await errorOf(response)) ?? "That couldn't be given.";
    const { character } = (await response.json()) as { character: Character };
    if (character.revision > this.sync.confirmed.revision) {
      this.sync = { ...this.sync, confirmed: character };
      this.changed();
    }
    return undefined;
  }

  dismiss(id: number) {
    this.notices = this.notices.filter((notice) => notice.id !== id);
    this.changed();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  private step(direction: "undo" | "redo") {
    const step = takeStep(this.undoStack, direction, shown(this.sync));
    if (!step) return;
    this.undoStack = step.stack;
    this.sync = queue(this.sync, ...step.actions);
    this.changed();
    this.schedule(this.timing.saveDelayMs);
  }

  private schedule(delay: number) {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.send(), delay);
  }

  /**
   * Saves everything waiting. False if some of it is still waiting (the server couldn't be
   * reached); changes the server refused have been let go, so they don't count.
   */
  private async settle(): Promise<boolean> {
    clearTimeout(this.timer);
    for (let attempt = 0; attempt < 5 && hasUnsaved(this.sync); attempt++) {
      await this.send();
      if (this.status.kind === "error") break;
    }
    return !hasUnsaved(this.sync);
  }

  /** Sends the next batch, or waits for the one on its way. */
  private send(): Promise<void> {
    if (!this.inFlight) {
      this.inFlight = this.sendBatch().finally(() => (this.inFlight = undefined));
    }
    return this.inFlight;
  }

  private async sendBatch() {
    const taken = takeBatch(this.sync);
    if (!taken || this.disposed) return;
    this.sync = taken.state;
    this.status = { kind: "saving" };
    this.changed();

    let response: Response;
    try {
      response = await this.fetcher(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ baseRevision: taken.baseRevision, actions: taken.batch }),
      });
    } catch {
      return this.failed("Couldn't reach Guildhall. Trying again…", true);
    }

    if (response.status >= 500) return this.failed("Couldn't save. Trying again…", true);
    if (!response.ok) {
      // The server won't take this batch however often it's sent: let it go.
      this.sync = confirmed(this.sync, this.sync.confirmed);
      const message =
        response.status === 404
          ? "This character has gone, or you can no longer change it. Reload the page."
          : ((await errorOf(response)) ?? "Those changes couldn't be saved.");
      this.status = { kind: "error", message, retrying: false };
      this.changed();
      return;
    }

    const answer = (await response.json()) as SaveAnswer;
    this.sync = confirmed(this.sync, answer.character);
    this.status = { kind: "saved" };
    this.notify(noticesFor(taken.batch, answer));
    this.changed();
    if (this.sync.queued.length > 0) this.schedule(0);
  }

  private failed(message: string, retrying: boolean) {
    this.sync = sendFailed(this.sync);
    this.status = { kind: "error", message, retrying };
    this.changed();
    if (retrying) this.schedule(this.timing.retryDelayMs);
  }

  private notify(texts: string[]) {
    if (texts.length === 0) return;
    const added = texts.map((text) => ({ id: ++this.noticeCount, text }));
    this.notices = [...this.notices, ...added].slice(-NOTICES_KEPT);
  }

  private changed() {
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) listener();
  }

  private makeSnapshot(): EditorSnapshot {
    return {
      character: shown(this.sync),
      status: this.status,
      notices: this.notices,
      canUndo: this.undoStack.undo.length > 0,
      canRedo: this.undoStack.redo.length > 0,
      unsaved: hasUnsaved(this.sync),
    };
  }
}

/** What to tell the editor after a save: fields someone else changed first, and dropped changes. */
function noticesFor(batch: CharacterAction[], answer: SaveAnswer): string[] {
  const texts = answer.results.flatMap((result, index) =>
    result.replaced !== undefined ? [replacedNotice(batch[index], result.replaced)] : [],
  );
  if (answer.results.some((result) => result.outcome === "dropped")) {
    texts.push("Some changes were about things removed elsewhere, so they were left out.");
  }
  if (texts.length === 0 && answer.changedElsewhere) {
    texts.push("Updated with changes made elsewhere.");
  }
  return texts;
}

async function errorOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}
