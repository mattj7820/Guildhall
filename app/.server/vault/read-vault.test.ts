import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readVault } from "./read-vault";

/** A throwaway vault in the OS temp folder, since these tests shape files on disk. */
let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "guildhall-read-vault-"));
  await writeFile(path.join(root, "Keep.md"), "A note");
  await writeFile(path.join(root, "Map.png"), "not really a png");
});
afterEach(() => rm(root, { recursive: true, force: true }));

const gone = () => Object.assign(new Error("gone"), { code: "ENOENT" });

describe("readVault while a sync tool is changing the folder", () => {
  it("leaves out files still being downloaded by rclone", async () => {
    await writeFile(path.join(root, "Town.png.a1b2c3.partial"), "half an image");
    await writeFile(path.join(root, "New.md.a1b2c3.partial"), "half a note");
    const snapshot = await readVault(root);
    expect(snapshot.assets).toEqual(["Map.png"]);
    expect(snapshot.notes.map((note) => note.path)).toEqual(["Keep.md"]);
  });

  it("skips a note that disappears between listing and reading it", async () => {
    await writeFile(path.join(root, "Moving.md"), "About to be replaced");
    const snapshot = await readVault(root, {
      readdir,
      readFile: ((file: string, encoding: BufferEncoding) =>
        file.endsWith("Moving.md")
          ? Promise.reject(gone())
          : readFile(file, encoding)) as typeof readFile,
    });
    expect(snapshot.notes.map((note) => note.path)).toEqual(["Keep.md"]);
  });

  it("skips a folder that disappears while being read", async () => {
    await mkdir(path.join(root, "Gone"));
    await writeFile(path.join(root, "Gone", "Inside.md"), "Soon deleted");
    const snapshot = await readVault(root, {
      readFile,
      readdir: ((folder: string, options: object) =>
        folder.endsWith("Gone")
          ? Promise.reject(gone())
          : readdir(folder, options as { withFileTypes: true })) as typeof readdir,
    });
    expect(snapshot.notes.map((note) => note.path)).toEqual(["Keep.md"]);
  });

  it("still fails on errors other than a missing file", async () => {
    const denied = Object.assign(new Error("denied"), { code: "EACCES" });
    await expect(
      readVault(root, { readdir, readFile: (() => Promise.reject(denied)) as typeof readFile }),
    ).rejects.toThrow("denied");
  });
});
