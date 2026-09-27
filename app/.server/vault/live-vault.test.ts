import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DM_VIEWER } from "~/campaign/types";
import { LiveVault } from "./live-vault";
import { Vault } from "./vault";

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

  it("ignores rclone's half-downloaded files", async () => {
    live = await LiveVault.open(root);
    await writeFile(path.join(root, "Second.md.x1y2.partial"), "Half a note");
    await writeFile(path.join(root, "Third.md"), "Third note");
    await vi.waitFor(() => expect(titles()).toEqual(["First", "Third"]), { timeout: 4000 });
  });
});

describe("LiveVault reloads", () => {
  /** A load that waits to be told to finish, so a test can overlap reloads on purpose. */
  function controlledLoad() {
    const finishers: ((vault: Vault) => void)[] = [];
    const load = vi.fn(() => new Promise<Vault>((resolve) => finishers.push(resolve)));
    const vault = (label: string) =>
      new Vault({ notes: [{ path: `${label}.md`, source: "" }], assets: [] });
    return { load, finish: (label: string) => finishers.shift()!(vault(label)) };
  }

  it("runs one rebuild at a time, and one more for changes made during it", async () => {
    const { load, finish } = controlledLoad();
    const opening = LiveVault.open("unused", { watchForChanges: false, load });
    finish("Opened");
    const live = await opening;

    const first = live.reload();
    const second = live.reload();
    const third = live.reload();
    expect(load).toHaveBeenCalledTimes(2); // opening, then the first rebuild

    finish("Older");
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    finish("Newer");
    await Promise.all([first, second, third]);

    expect(load).toHaveBeenCalledTimes(3);
    expect(live.current.notes(DM_VIEWER).map((note) => note.title)).toEqual(["Newer"]);
  });

  it("keeps serving the previous vault when a rebuild fails", async () => {
    const opened = new Vault({ notes: [{ path: "Opened.md", source: "" }], assets: [] });
    const load = vi.fn().mockResolvedValueOnce(opened).mockRejectedValueOnce(new Error("disk"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const live = await LiveVault.open("unused", { watchForChanges: false, load });
    await live.reload();
    expect(live.current).toBe(opened);
    expect(quiet).toHaveBeenCalledWith(expect.stringMatching(/Reload failed/), expect.any(Error));
    quiet.mockRestore();
  });
});
