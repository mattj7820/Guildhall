/**
 * The only module in the app that writes files (see the exception in eslint.config.js). It only
 * ever writes inside the data folder, which config guarantees is outside the vault.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { whenFree } from "./when-free";
import type { z } from "zod";

export class DataFileError extends Error {
  override name = "DataFileError";
}

/**
 * One JSON file, validated on every read. The file is read fresh each time, so the data folder
 * is the single source of truth (it can be backed up, restored or hand-edited). Updates are queued
 * so two requests can't interleave, and written atomically, so a crash can't leave half a file.
 */
export class JsonFile<T> {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly filePath: string,
    private readonly schema: z.ZodType<T>,
    private readonly empty: () => T,
  ) {}

  /** The current contents; the empty value if the file doesn't exist yet. */
  async read(): Promise<T> {
    let raw: string;
    try {
      raw = await whenFree(() => readFile(this.filePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.empty();
      throw error;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw this.unreadable("it isn't valid JSON");
    }
    const parsed = this.schema.safeParse(data);
    if (!parsed.success) throw this.unreadable(parsed.error.issues[0]?.message ?? "invalid data");
    return parsed.data;
  }

  /**
   * Reads, changes and writes the file as one step. A file that can't be read is never
   * overwritten: the error is thrown instead, so nothing is lost.
   */
  update<R>(change: (current: T) => { next: T; result: R }): Promise<R> {
    const run = async () => {
      const { next, result } = change(await this.read());
      await this.write(this.schema.parse(next));
      return result;
    };
    const done = this.queue.then(run);
    this.queue = done.catch(() => undefined);
    return done;
  }

  private async write(data: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", "utf8");
    await whenFree(() => rename(temporary, this.filePath));
  }

  private unreadable(reason: string): DataFileError {
    return new DataFileError(
      `Couldn't read ${this.filePath}: ${reason}. It hasn't been changed; fix or move it aside.`,
    );
  }
}
