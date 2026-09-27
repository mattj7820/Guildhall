import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, record, redo, startHistory, undo } from "./history";

describe("undo history", () => {
  it("undoes changes one at a time, most recent first", () => {
    let history = startHistory("a");
    history = record(record(history, "b"), "c");
    history = undo(history);
    expect(history.present).toBe("b");
    expect(undo(history).present).toBe("a");
  });

  it("does nothing with nothing to undo", () => {
    const history = startHistory("a");
    expect(undo(history)).toBe(history);
  });

  it("doesn't record a change that changed nothing", () => {
    const state = { round: 1 };
    const history = startHistory(state);
    expect(record(history, state)).toBe(history);
  });

  it(`remembers only the last ${HISTORY_LIMIT} changes`, () => {
    let history = startHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) history = record(history, i);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
  });

  it("redoes what was undone, until something new is recorded", () => {
    let history = record(record(startHistory("a"), "b"), "c");
    history = undo(undo(history));
    expect(history.present).toBe("a");
    history = redo(history);
    expect(history.present).toBe("b");
    expect(redo(history).present).toBe("c");
    expect(redo(record(history, "x"))).toEqual(record(history, "x"));
  });

  it("does nothing with nothing to redo", () => {
    const history = startHistory("a");
    expect(redo(history)).toBe(history);
  });

  it("merges a run of changes with the same key into one step", () => {
    let history = startHistory("");
    for (const text of ["M", "Mi", "Mil", "Mill"]) history = record(history, text, "name:1");
    history = record(history, "moved", "point:1");
    expect(undo(history).present).toBe("Mill");
    expect(undo(undo(history)).present).toBe("");
  });

  it("starts a new step after an undo, even with the same key", () => {
    let history = record(startHistory("a"), "b", "k");
    history = record(undo(history), "c", "k");
    expect(history.past).toEqual(["a"]);
    expect(undo(history).present).toBe("a");
  });
});
