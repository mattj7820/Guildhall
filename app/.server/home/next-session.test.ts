import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextSession } from "./next-session";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-next-session-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

describe("NextSession", () => {
  it("has no date until one is set", async () => {
    expect(await NextSession.inFolder(folder).get()).toBeUndefined();
  });

  it("keeps the date in the data folder, as an instant, until it's cleared", async () => {
    await NextSession.inFolder(folder).set(new Date("2026-11-06T19:00:00+00:00"));
    expect(await NextSession.inFolder(folder).get()).toBe("2026-11-06T19:00:00.000Z");
    await NextSession.inFolder(folder).set(undefined);
    expect(await NextSession.inFolder(folder).get()).toBeUndefined();
  });

  it("reads a date it can't understand as none, rather than refusing the file", async () => {
    await writeFile(path.join(folder, "next-session.json"), '{"version":1,"at":"Friday"}');
    expect(await NextSession.inFolder(folder).get()).toBeUndefined();
  });
});
