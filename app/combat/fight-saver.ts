/**
 * Saves the DM's tracker to the server's fight: one save at a time, always the latest encounter,
 * each saying which revision it was built on. Pushes from the server (a player ending their turn,
 * another tab) are taken up only when nothing of the DM's is on its way, so they never overwrite
 * the DM's own changes; a save built on an old revision comes back with the newer fight instead.
 */
import type { MapId } from "~/maps/types";
import type { Encounter } from "./types";

/** A fight as the DM gets it: what the saver needs of it. */
export interface DmFight {
  encounter: Encounter;
  revision: number;
}

export type SaveStatus =
  /** Everything is on the server. */
  | "saved"
  | "saving"
  /** The server couldn't be reached; it will try again. */
  | "offline"
  /** The fight had changed elsewhere; the newer one is showing now. */
  | "replaced"
  /** The server wouldn't take it (not the DM's to change, or not readable); not tried again. */
  | "refused";

export interface SaveAnswer {
  status: number;
  fight?: DmFight | null;
}

export type SendSave = (body: {
  intent: "save";
  encounter: Encounter;
  after: number;
  map?: MapId;
}) => Promise<SaveAnswer>;

/** How long to wait before trying again when the server can't be reached. */
export const RETRY_MS = 3000;

export class FightSaver {
  private inFlight = false;
  private pending?: Encounter;
  private retry?: ReturnType<typeof setTimeout>;
  status: SaveStatus = "saved";

  constructor(
    private revision: number,
    private readonly send: SendSave,
    /** Told when the newer fight from the server should replace the tracker's. */
    private onReplaced: (fight: DmFight | null) => void,
    private readonly onStatus: (status: SaveStatus) => void,
    private readonly map?: MapId,
  ) {}

  /** Who to tell of a newer fight: the tracker that takes it up is made after the saver. */
  setOnReplaced(listener: (fight: DmFight | null) => void): void {
    this.onReplaced = listener;
  }

  /** The tracker changed: save it, after anything already on its way. */
  save(encounter: Encounter): void {
    this.pending = encounter;
    if (!this.inFlight) void this.flush();
  }

  /**
   * The server pushed the fight. Taken up (true) only when it's newer than the tracker's and
   * nothing of the DM's is waiting to be saved; otherwise the next save sorts it out.
   */
  pushed(fight: DmFight | null): boolean {
    if (this.inFlight || this.pending) return false;
    const revision = fight?.revision ?? 0;
    if (fight ? revision <= this.revision : this.revision === 0) return false;
    this.revision = revision;
    return true;
  }

  private setStatus(status: SaveStatus) {
    if (status === this.status) return;
    this.status = status;
    this.onStatus(status);
  }

  private async flush(): Promise<void> {
    const encounter = this.pending;
    if (!encounter) return;
    this.pending = undefined;
    this.inFlight = true;
    this.setStatus("saving");
    let answer: SaveAnswer | undefined;
    try {
      answer = await this.send({
        intent: "save",
        encounter,
        after: this.revision,
        ...(this.map && { map: this.map }),
      });
    } catch {
      answer = undefined;
    }
    this.inFlight = false;

    if (!answer || answer.status >= 500) {
      // Keep the newest of what was waiting, and try again shortly.
      this.pending ??= encounter;
      this.setStatus("offline");
      clearTimeout(this.retry);
      this.retry = setTimeout(() => void this.flush(), RETRY_MS);
      return;
    }
    if (answer.status === 409) {
      // Changed elsewhere: the newer fight wins, and anything still waiting was built on the old.
      this.pending = undefined;
      this.revision = answer.fight?.revision ?? 0;
      this.setStatus("replaced");
      this.onReplaced(answer.fight ?? null);
      return;
    }
    if (answer.status < 200 || answer.status >= 300) {
      // Sending the same again would get the same answer, so it waits for the next change.
      this.setStatus("refused");
      if (this.pending) return this.flush();
      return;
    }
    if (answer.fight) this.revision = answer.fight.revision;
    if (this.pending) return this.flush();
    this.setStatus("saved");
  }

  stop(): void {
    clearTimeout(this.retry);
  }
}
