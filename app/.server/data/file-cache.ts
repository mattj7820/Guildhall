/**
 * The second of the two modules allowed to write files (see eslint.config.js): generated files,
 * such as the tiles of players' map images, kept in folders inside the data folder's `cache`.
 * Config guarantees the data folder is outside the vault, and everything here is disposable:
 * deleting the cache only means the files are made again.
 */
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { whenFree } from "./when-free";

/** Keys, versions and file names are plain words, so nothing can reach outside the cache. */
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

export type MakeFiles = () => Promise<Map<string, Uint8Array>>;

/**
 * Sets of generated files, one folder per key and version, e.g. one image's tiles for one version
 * of the file. Making a new version removes the key's older ones. Only one set is made at a time,
 * which keeps memory use bounded, and asking again while it's being made waits for the same one.
 */
export class FileCache {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly making = new Map<string, Promise<string>>();

  constructor(private readonly root: string) {}

  /** The folder holding this version's files, made first if they aren't there yet. */
  ensure(key: string, version: string, make: MakeFiles): Promise<string> {
    let folder: string;
    try {
      folder = this.folder(key, version);
    } catch (error) {
      return Promise.reject(error);
    }
    const id = `${key}/${version}`;
    const pending = this.making.get(id);
    if (pending) return pending;

    const run = async () => {
      if (await exists(folder)) return folder;
      const files = await make();
      await this.write(key, version, files);
      return folder;
    };
    const done = this.queue.then(run).finally(() => this.making.delete(id));
    this.making.set(id, done);
    this.queue = done.catch(() => undefined);
    return done;
  }

  /** A generated file's contents, or undefined if it isn't there. */
  async read(key: string, version: string, name: string): Promise<Buffer | undefined> {
    if (!SAFE_NAME.test(name)) return undefined;
    try {
      return await readFile(path.join(this.folder(key, version), name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private folder(key: string, version: string): string {
    if (!SAFE_NAME.test(key) || !SAFE_NAME.test(version)) {
      throw new Error(`Not a safe cache name: ${key}/${version}`);
    }
    return path.join(this.root, key, version);
  }

  /** Writes into a temporary folder, then renames it into place, so a crash leaves no half set. */
  private async write(key: string, version: string, files: Map<string, Uint8Array>) {
    const keyFolder = path.join(this.root, key);
    const temporary = path.join(keyFolder, `.making-${version}-${process.pid}`);
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    for (const [name, contents] of files) {
      if (!SAFE_NAME.test(name)) throw new Error(`Not a safe cache file name: ${name}`);
      await writeFile(path.join(temporary, name), contents);
    }
    await whenFree(() => rename(temporary, this.folder(key, version)));
    // Older versions are no longer needed.
    for (const entry of await readdir(keyFolder)) {
      if (entry !== version && !entry.startsWith(".making-")) {
        await rm(path.join(keyFolder, entry), { recursive: true, force: true });
      }
    }
  }
}

async function exists(folder: string): Promise<boolean> {
  try {
    await readdir(folder);
    return true;
  } catch {
    return false;
  }
}
