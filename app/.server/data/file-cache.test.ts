import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCache } from "./file-cache";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-cache-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const files = (entries: Record<string, string>) => async () =>
  new Map(Object.entries(entries).map(([name, text]) => [name, Buffer.from(text)]));

/** Counts how often files are made. */
function counting(entries: Record<string, string>) {
  const made = { count: 0 };
  const make = async () => {
    made.count++;
    return files(entries)();
  };
  return { made, make };
}

describe("FileCache", () => {
  it("makes a version's files once, and reads them back", async () => {
    const cache = new FileCache(folder);
    const { made, make } = counting({ "0-0.webp": "tile" });
    await cache.ensure("image", "v1", make);
    await cache.ensure("image", "v1", make);
    expect(made.count).toBe(1);
    expect((await cache.read("image", "v1", "0-0.webp"))?.toString()).toBe("tile");
  });

  it("keeps the files for a restart", async () => {
    await new FileCache(folder).ensure("image", "v1", files({ a: "kept" }));
    const { made, make } = counting({ a: "remade" });
    await new FileCache(folder).ensure("image", "v1", make);
    expect(made.count).toBe(0);
  });

  it("makes the files once for requests that arrive together", async () => {
    const cache = new FileCache(folder);
    const { made, make } = counting({ a: "x" });
    await Promise.all([1, 2, 3].map(() => cache.ensure("image", "v1", make)));
    expect(made.count).toBe(1);
  });

  it("makes one set at a time", async () => {
    const cache = new FileCache(folder);
    let running = 0;
    let most = 0;
    const slow = async () => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running--;
      return new Map([["a", Buffer.from("x")]]);
    };
    await Promise.all(["one", "two", "three"].map((key) => cache.ensure(key, "v1", slow)));
    expect(most).toBe(1);
  });

  it("removes a key's older versions once a new one is made", async () => {
    const cache = new FileCache(folder);
    await cache.ensure("image", "v1", files({ a: "old" }));
    await cache.ensure("other", "v1", files({ a: "other" }));
    await cache.ensure("image", "v2", files({ a: "new" }));
    expect(await readdir(path.join(folder, "image"))).toEqual(["v2"]);
    expect(await cache.read("image", "v1", "a")).toBeUndefined();
    expect(await readdir(path.join(folder, "other"))).toEqual(["v1"]);
  });

  it("leaves nothing behind when making the files fails, and tries again next time", async () => {
    const cache = new FileCache(folder);
    await expect(
      cache.ensure("image", "v1", () => Promise.reject(new Error("unreadable image"))),
    ).rejects.toThrow("unreadable image");
    expect(await cache.read("image", "v1", "a")).toBeUndefined();
    await cache.ensure("image", "v1", files({ a: "made" }));
    expect((await cache.read("image", "v1", "a"))?.toString()).toBe("made");
  });

  it.each(["../escape", "a/b", "", ".hidden", "a\\b"])(
    "refuses a name that could leave the cache: %j",
    async (name) => {
      const cache = new FileCache(folder);
      await expect(cache.ensure(name, "v1", files({ a: "x" }))).rejects.toThrow();
      await expect(cache.ensure("image", "v1", files({ [name]: "x" }))).rejects.toThrow();
      expect(await cache.read("image", "v1", name)).toBeUndefined();
    },
  );
});
