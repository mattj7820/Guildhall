import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FightSaver,
  RETRY_MS,
  type DmFight,
  type SaveAnswer,
  type SaveStatus,
} from "./fight-saver";
import { encounter, monster } from "./test-builders";
import type { Encounter } from "./types";

/** Stands in for the server's fight: one stored revision, refusing saves built on older ones. */
class StandInServer {
  revision = 0;
  stored?: Encounter;
  saves: { after: number; names: string[] }[] = [];
  down = false;
  /** Answers wait until released, so a test can overlap saves. */
  private waiting: (() => void)[] = [];
  holding = false;

  send = async (body: { encounter: Encounter; after: number }): Promise<SaveAnswer> => {
    if (this.holding) await new Promise<void>((resolve) => this.waiting.push(resolve));
    if (this.down) throw new Error("offline");
    this.saves.push({ after: body.after, names: body.encounter.combatants.map((c) => c.name) });
    if (body.after !== this.revision) {
      return {
        status: 409,
        fight: this.stored && { encounter: this.stored, revision: this.revision },
      };
    }
    this.revision += 1;
    this.stored = body.encounter;
    return { status: 200, fight: { encounter: body.encounter, revision: this.revision } };
  };

  release() {
    this.holding = false;
    for (const resolve of this.waiting.splice(0)) resolve();
  }

  /** Someone else changed the fight (a player ending their turn). */
  changeElsewhere(names: string[]): DmFight {
    this.revision += 1;
    this.stored = withMonsters(...names);
    return { encounter: this.stored, revision: this.revision };
  }
}

const withMonsters = (...names: string[]) => encounter(names.map((name) => monster(name)));

let server: StandInServer;
let replaced: (DmFight | null)[];
let statuses: SaveStatus[];
let saver: FightSaver;

beforeEach(() => {
  vi.useFakeTimers();
  server = new StandInServer();
  replaced = [];
  statuses = [];
  saver = new FightSaver(
    0,
    server.send,
    (fight) => replaced.push(fight),
    (status) => statuses.push(status),
  );
});
afterEach(() => {
  saver.stop();
  vi.useRealTimers();
});

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("FightSaver", () => {
  it("saves each change, built on the revision it last had", async () => {
    saver.save(withMonsters("A"));
    await settle();
    saver.save(withMonsters("A", "B"));
    await settle();
    expect(server.saves).toEqual([
      { after: 0, names: ["A"] },
      { after: 1, names: ["A", "B"] },
    ]);
    expect(statuses).toEqual(["saving", "saved", "saving", "saved"]);
  });

  it("sends one save at a time, and only the latest of what changed meanwhile", async () => {
    server.holding = true;
    saver.save(withMonsters("A"));
    saver.save(withMonsters("A", "B"));
    saver.save(withMonsters("A", "B", "C"));
    server.release();
    await settle();
    server.release();
    await settle();
    expect(server.saves.map((save) => save.names)).toEqual([["A"], ["A", "B", "C"]]);
  });

  it("takes up the server's newer fight when another tab or a player changed it", async () => {
    saver.save(withMonsters("A"));
    await settle();
    server.changeElsewhere(["A", "moved on"]);
    saver.save(withMonsters("A", "mine"));
    await settle();
    expect(replaced.map((fight) => fight?.encounter.combatants.map((c) => c.name))).toEqual([
      ["A", "moved on"],
    ]);
    expect(statuses.at(-1)).toBe("replaced");
    // Built on the newer fight, the next save goes through.
    saver.save(withMonsters("A", "moved on", "next"));
    await settle();
    expect(server.stored?.combatants.map((c) => c.name)).toEqual(["A", "moved on", "next"]);
  });

  it("takes a pushed fight only when it's newer and nothing of the DM's is on its way", async () => {
    saver.save(withMonsters("A"));
    await settle();
    expect(saver.pushed({ encounter: withMonsters("A"), revision: 1 })).toBe(false);
    const newer = server.changeElsewhere(["B"]);

    server.holding = true;
    saver.save(withMonsters("mine"));
    expect(saver.pushed(newer)).toBe(false);
    server.release();
    await settle();

    expect(saver.pushed({ encounter: withMonsters("C"), revision: server.revision + 1 })).toBe(
      true,
    );
  });

  it("takes up a fight ended elsewhere", async () => {
    saver.save(withMonsters("A"));
    await settle();
    expect(saver.pushed(null)).toBe(true);
    expect(saver.pushed(null)).toBe(false);
  });

  it("says when the server refuses a save, rather than that it's saved", async () => {
    for (const status of [400, 403, 404]) {
      const refusing = new FightSaver(
        0,
        async () => ({ status }),
        () => {},
        (each) => statuses.push(each),
      );
      statuses = [];
      refusing.save(withMonsters("A"));
      await settle();
      expect(statuses, `answered ${status}`).toEqual(["saving", "refused"]);
      refusing.stop();
    }
  });

  it("tries again with the next change after a refusal", async () => {
    let answer = 400;
    const sent: string[][] = [];
    const flaky = new FightSaver(
      0,
      async (body) => {
        sent.push(body.encounter.combatants.map((c) => c.name));
        return answer === 200
          ? { status: 200, fight: { encounter: body.encounter, revision: 1 } }
          : { status: answer };
      },
      () => {},
      (each) => statuses.push(each),
    );
    flaky.save(withMonsters("A"));
    await settle();
    answer = 200;
    flaky.save(withMonsters("A", "B"));
    await settle();
    expect(sent).toEqual([["A"], ["A", "B"]]);
    expect(statuses.at(-1)).toBe("saved");
    flaky.stop();
  });

  it("keeps trying while the server can't be reached, then saves the latest", async () => {
    server.down = true;
    saver.save(withMonsters("A"));
    await settle();
    expect(statuses).toEqual(["saving", "offline"]);
    saver.save(withMonsters("A", "B"));
    await settle();
    server.down = false;
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(server.stored?.combatants.map((c) => c.name)).toEqual(["A", "B"]);
    expect(statuses.at(-1)).toBe("saved");
  });
});
