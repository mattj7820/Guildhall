import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encounter, idSequence, monster, player } from "~/combat/test-builders";
import { DataFileError } from "../data/json-store";
import { DEFAULT_PREPARED_NAME, PreparedEncounters } from "./prepared-encounters";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-prepared-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** A store with a controllable clock and predictable IDs. */
function store() {
  let minute = 0;
  const now = () => new Date(Date.UTC(2026, 8, 26, 18, minute++));
  return PreparedEncounters.inFolder(folder, { now, createId: idSequence("prep") });
}

const ambush = () =>
  encounter([
    monster("Goblin 1", { hp: { current: 5, max: 7, temp: 0 } }),
    player("Blink Dog", { controller: { id: "sam", name: "Sam" } }),
  ]);

describe("PreparedEncounters", () => {
  it("starts empty", async () => {
    expect(await store().list()).toEqual([]);
  });

  it("creates an encounter with a default name and an empty fight", async () => {
    const created = await store().create();
    expect(created).toMatchObject({
      name: DEFAULT_PREPARED_NAME,
      notes: "",
      createdAt: "2026-09-26T18:00:00.000Z",
      updatedAt: "2026-09-26T18:00:00.000Z",
      encounter: { phase: "setup", combatants: [] },
    });
    expect(created.lastRunAt).toBeUndefined();
  });

  it("keeps encounters in the data folder, so they survive a restart", async () => {
    const { id } = await store().create({ name: "Mill ambush", encounter: ambush() });
    const afterRestart = PreparedEncounters.inFolder(folder);
    expect(await afterRestart.get(id)).toMatchObject({ name: "Mill ambush", encounter: ambush() });
    const onDisk = JSON.parse(
      await readFile(path.join(folder, "prepared-encounters.json"), "utf8"),
    );
    expect(onDisk).toMatchObject({ version: 1, encounters: [{ name: "Mill ambush" }] });
  });

  it("updates the name, notes and fight, and when it was edited", async () => {
    const prepared = store();
    const { id } = await prepared.create();
    const updated = await prepared.update(id, {
      name: "  Bridge   toll ",
      notes: "Fixture notes",
      encounter: ambush(),
    });
    expect(updated).toMatchObject({
      name: "Bridge toll",
      notes: "Fixture notes",
      updatedAt: "2026-09-26T18:01:00.000Z",
    });
    expect((await prepared.get(id))?.encounter.combatants).toHaveLength(2);
  });

  it("falls back to the default name when it's cleared", async () => {
    const prepared = store();
    const { id } = await prepared.create({ name: "Named" });
    expect((await prepared.update(id, { name: "   " }))?.name).toBe(DEFAULT_PREPARED_NAME);
  });

  it("lists the most recently edited first", async () => {
    const prepared = store();
    const first = await prepared.create({ name: "First" });
    await prepared.create({ name: "Second" });
    await prepared.update(first.id, { notes: "edited" });
    expect((await prepared.list()).map((p) => p.name)).toEqual(["First", "Second"]);
  });

  it("records a run without counting it as an edit", async () => {
    const prepared = store();
    const { id, updatedAt } = await prepared.create();
    const run = await prepared.markRun(id);
    expect(run).toMatchObject({ updatedAt, lastRunAt: "2026-09-26T18:01:00.000Z" });
  });

  it("duplicates an encounter as a separate copy", async () => {
    const prepared = store();
    const original = await prepared.create({ name: "Mill ambush", encounter: ambush() });
    const copy = await prepared.duplicate(original.id);
    expect(copy).toMatchObject({ name: "Mill ambush (copy)", notes: original.notes });
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.encounter.combatants).toEqual(original.encounter.combatants);

    await prepared.update(copy!.id, { encounter: encounter([]) });
    expect((await prepared.get(original.id))?.encounter.combatants).toHaveLength(2);
  });

  it("keeps where a fight set up on a map stands, through edits and copies", async () => {
    const prepared = store();
    const placement = { map: "mill", at: { "Goblin 1": [0.2, 0.3] as [number, number] } };
    const original = await prepared.create({ name: "Mill ambush", encounter: ambush(), placement });
    await prepared.update(original.id, { notes: "Fixture: tests placements" });
    expect((await prepared.get(original.id))?.placement).toEqual(placement);
    expect((await prepared.duplicate(original.id))?.placement).toEqual(placement);
  });

  it("deletes an encounter", async () => {
    const prepared = store();
    const { id } = await prepared.create();
    expect(await prepared.delete(id)).toBe(true);
    expect(await prepared.get(id)).toBeUndefined();
    expect(await prepared.delete(id)).toBe(false);
  });

  it("reports changes to an encounter that no longer exists", async () => {
    const prepared = store();
    expect(await prepared.update("missing", { name: "X" })).toBeUndefined();
    expect(await prepared.markRun("missing")).toBeUndefined();
    expect(await prepared.duplicate("missing")).toBeUndefined();
  });

  it("refuses to save a fight that has already started", async () => {
    const prepared = store();
    const { id } = await prepared.create();
    const started = { ...ambush(), phase: "active" as const, round: 1, activeId: "Goblin 1" };
    await expect(prepared.update(id, { encounter: started })).rejects.toThrow();
    expect((await prepared.get(id))?.encounter.phase).toBe("setup");
  });

  it("reports a damaged file instead of overwriting it", async () => {
    const filePath = path.join(folder, "prepared-encounters.json");
    await writeFile(filePath, '{"version": 1, "encounters": [{"name": 3}]}');
    await expect(store().list()).rejects.toThrow(DataFileError);
    await expect(store().create()).rejects.toThrow(DataFileError);
    expect(await readFile(filePath, "utf8")).toBe('{"version": 1, "encounters": [{"name": 3}]}');
  });
});
