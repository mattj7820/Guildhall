import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DM_VIEWER } from "~/campaign/types";
import { LiveVault } from "./live-vault";

/**
 * Uses a throwaway vault in the OS temp folder, because this test has to change files on disk.
 * The fixture vault is never modified.
 */
describe("LiveVault", () => {
  let root: string;
  let live: LiveVault;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "guildhall-live-vault-"));
    await writeFile(path.join(root, "First.md"), "First note");
  });

  afterEach(async () => {
    await live?.close();
    await rm(root, { recursive: true, force: true });
  });

  const titles = () => live.current.notes(DM_VIEWER).map((note) => note.title);

  it("serves the vault as it was when opened", async () => {
    live = await LiveVault.open(root, { watchForChanges: false });
    expect(titles()).toEqual(["First"]);
  });

  it("picks up notes added while running", async () => {
    live = await LiveVault.open(root);
    await writeFile(path.join(root, "Second.md"), "Second note");

    await vi.waitFor(() => expect(titles()).toEqual(["First", "Second"]), { timeout: 4000 });
  });

  it("can be reloaded on demand", async () => {
    live = await LiveVault.open(root, { watchForChanges: false });
    await writeFile(path.join(root, "Second.md"), "Second note");
    await live.reload();
    expect(titles()).toEqual(["First", "Second"]);
  });
});
