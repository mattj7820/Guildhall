import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Viewer } from "~/campaign/types";
import { encounter, inCombat, monster, player } from "~/combat/test-builders";
import { CurrentFight } from "./current-fight";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-fight-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const one = { id: "player one", name: "Player One" };
const playerOne: Viewer = { role: "player", playerId: "player one" };
const combatants = [
  player("Aria", { controller: one, initiative: 18 }),
  monster("Goblin 1", { initiative: 9 }),
];

describe("CurrentFight", () => {
  it("has no fight until one is saved", async () => {
    expect(await CurrentFight.inFolder(folder).get()).toBeUndefined();
  });

  it("keeps the fight in the data folder, so it survives a restart, with its map", async () => {
    const fight = encounter(combatants);
    expect(await CurrentFight.inFolder(folder).save(fight, 0, "cave")).toEqual({
      fight: { encounter: fight, revision: 1, map: "cave" },
    });
    expect(await CurrentFight.inFolder(folder).get()).toEqual({
      encounter: fight,
      revision: 1,
      map: "cave",
    });
    const onDisk = JSON.parse(await readFile(path.join(folder, "fight.json"), "utf8"));
    expect(onDisk.fight.revision).toBe(1);
  });

  it("refuses a save from a tab that hasn't seen the latest fight, and gives it the latest", async () => {
    const fights = CurrentFight.inFolder(folder);
    await fights.save(encounter(combatants), 0);
    const newer = await fights.save(encounter(combatants.slice(0, 1)), 1);
    const stale = await fights.save(encounter([]), 1);
    expect(stale).toEqual({ stale: "fight" in newer ? newer.fight : undefined });
    expect((await fights.get())?.revision).toBe(2);
  });

  it("keeps the fight's map when a save doesn't say", async () => {
    const fights = CurrentFight.inFolder(folder);
    await fights.save(encounter(combatants), 0, "cave");
    await fights.save(encounter(combatants), 1);
    expect((await fights.get())?.map).toBe("cave");
  });

  it("lets a player end their own turn, and nobody else's", async () => {
    const fights = CurrentFight.inFolder(folder);
    await fights.save(inCombat(combatants, "Goblin 1"), 0);
    expect(await fights.endTurn(playerOne)).toBeUndefined();

    await fights.save(inCombat(combatants, "Aria"), 1);
    const ended = await fights.endTurn(playerOne);
    expect(ended?.revision).toBe(3);
    const active = ended?.encounter.combatants.find((c) => c.id === ended.encounter.activeId);
    expect(active?.name).toBe("Goblin 1");
  });

  it("lets players move freely, kept through the tracker's saves, without a new revision", async () => {
    const fights = CurrentFight.inFolder(folder);
    expect(await fights.setFreeMovement(true)).toBeUndefined();
    await fights.save(encounter(combatants), 0);
    expect(await fights.setFreeMovement(true)).toMatchObject({ freeMovement: true, revision: 1 });
    await fights.save(encounter(combatants), 1);
    expect((await fights.get())?.freeMovement).toBe(true);
    expect(await fights.setFreeMovement(false)).not.toHaveProperty("freeMovement");
  });

  it("says which fight a save replaced, so monsters who left can be cleared away", async () => {
    const fights = CurrentFight.inFolder(folder);
    expect(await fights.save(encounter(combatants), 0)).not.toHaveProperty("previous");
    const saved = await fights.save(encounter(combatants.slice(0, 1)), 1);
    expect(saved).toMatchObject({ previous: { revision: 1 } });
  });

  it("ends the fight", async () => {
    const fights = CurrentFight.inFolder(folder);
    await fights.save(encounter(combatants), 0);
    expect(await fights.end()).toMatchObject({ revision: 1 });
    expect(await fights.get()).toBeUndefined();
    // A new fight starts from the beginning.
    expect(await fights.save(encounter(combatants), 0)).toHaveProperty("fight");
  });
});
