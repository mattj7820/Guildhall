import { describe, expect, it } from "vitest";
import { applyActions, type CharacterAction } from "./actions";
import {
  confirmed,
  hasUnsaved,
  queue,
  refreshed,
  sendFailed,
  shown,
  startSync,
  takeBatch,
} from "./sync";
import { aCharacter, anItem } from "./test-builders";
import type { Character, PlayerCharacter } from "./types";

const strength = (value: number): CharacterAction => ({ type: "ability", ability: "str", value });
const str = (character: Character) => (character as PlayerCharacter).sheet.abilities.str;

describe("syncing an open sheet", () => {
  const server = aCharacter({ revision: 4 });

  it("shows unsaved changes straight away", () => {
    const state = queue(startSync(server), strength(14));
    expect(str(shown(state))).toBe(14);
    expect(hasUnsaved(state)).toBe(true);
  });

  it("sends one batch at a time, with the revision it was based on", () => {
    const state = queue(startSync(server), strength(14), strength(15));
    const taken = takeBatch(state)!;
    expect(taken.batch).toEqual([strength(14), strength(15)]);
    expect(taken.baseRevision).toBe(4);

    const later = queue(taken.state, strength(16));
    expect(takeBatch(later)).toBeUndefined();
    expect(str(shown(later))).toBe(16);
  });

  it("rebases what was queued meanwhile onto the server's answer, which has others' changes", () => {
    const taken = takeBatch(queue(startSync(server), strength(14)))!;
    const meanwhile = queue(taken.state, {
      type: "inventory",
      change: { type: "add", item: anItem({ id: "rope" }) },
    });

    // The server applied our batch after the DM gave the character a torch.
    const answer = applyActions(
      aCharacter({ revision: 6, items: [anItem({ id: "torch", name: "Torch" })] }),
      [strength(14)],
    ).character;
    const state = confirmed(meanwhile, answer);

    expect(str(shown(state))).toBe(14);
    expect(shown(state).inventory.items.map((item) => item.id)).toEqual(["torch", "rope"]);
    expect(takeBatch(state)?.batch).toHaveLength(1);
  });

  it("puts a failed batch back in front of anything queued since", () => {
    const taken = takeBatch(queue(startSync(server), strength(14)))!;
    const state = sendFailed(queue(taken.state, strength(15)));
    expect(takeBatch(state)?.batch).toEqual([strength(14), strength(15)]);
  });

  it("takes a newer copy from the server when nothing is on its way", () => {
    const newer = aCharacter({ revision: 5, sheet: aCharacter().sheet });
    expect(refreshed(startSync(server), newer).confirmed).toBe(newer);
  });

  it("ignores an older copy, or any copy while a batch is on its way", () => {
    const older = aCharacter({ revision: 3 });
    expect(refreshed(startSync(server), older).confirmed).toBe(server);

    const sending = takeBatch(queue(startSync(server), strength(14)))!.state;
    expect(refreshed(sending, aCharacter({ revision: 9 })).confirmed).toBe(server);
  });
});
