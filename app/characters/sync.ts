/**
 * Keeping an open sheet in step with the server, without waiting for it. The sheet shows the
 * server's last copy with the unsaved actions applied on top. A batch is sent at a time; when the
 * server answers, its copy (which includes that batch, and anyone else's changes) becomes the
 * base, and whatever was queued meanwhile is applied on top of it again.
 */
import { applyActions, type CharacterAction } from "./actions";
import type { Character } from "./types";

export interface SyncState {
  /** The character as the server last said it was. */
  confirmed: Character;
  /** Sent and waiting for the server's answer. */
  sending: CharacterAction[];
  /** Made since, not sent yet. */
  queued: CharacterAction[];
}

export function startSync(character: Character): SyncState {
  return { confirmed: character, sending: [], queued: [] };
}

/** What the sheet shows: the server's copy with every unsaved action on top. */
export function shown(state: SyncState): Character {
  if (state.sending.length === 0 && state.queued.length === 0) return state.confirmed;
  return applyActions(state.confirmed, [...state.sending, ...state.queued]).character;
}

export function queue(state: SyncState, ...actions: CharacterAction[]): SyncState {
  return { ...state, queued: [...state.queued, ...actions] };
}

export const hasUnsaved = (state: SyncState) => state.sending.length > 0 || state.queued.length > 0;

/** The next batch to send, if there's one and nothing is on its way already. */
export function takeBatch(
  state: SyncState,
): { state: SyncState; batch: CharacterAction[]; baseRevision: number } | undefined {
  if (state.sending.length > 0 || state.queued.length === 0) return undefined;
  return {
    state: { ...state, sending: state.queued, queued: [] },
    batch: state.queued,
    baseRevision: state.confirmed.revision,
  };
}

/** The server applied the batch and sent back its copy. */
export function confirmed(state: SyncState, server: Character): SyncState {
  return { ...state, confirmed: server, sending: [] };
}

/** The batch didn't reach the server: send it again, before anything queued since. */
export function sendFailed(state: SyncState): SyncState {
  return { ...state, sending: [], queued: [...state.sending, ...state.queued] };
}

/**
 * A fresh copy from the server (someone else may have changed it). Ignored while a batch is on its
 * way, since the answer will be newer, and if it's older than what's already known.
 */
export function refreshed(state: SyncState, server: Character): SyncState {
  if (state.sending.length > 0 || server.revision < state.confirmed.revision) return state;
  return { ...state, confirmed: server };
}
