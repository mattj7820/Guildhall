import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, record, startHistory, undo } from "./history";

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
});
