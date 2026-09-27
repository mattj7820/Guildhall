import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DataFileError, JsonFile } from "./json-store";

const counterSchema = z.object({ count: z.number().int() });
type Counter = z.infer<typeof counterSchema>;

let folder: string;
let filePath: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-json-store-"));
  filePath = path.join(folder, "nested", "counter.json");
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const counterFile = () => new JsonFile<Counter>(filePath, counterSchema, () => ({ count: 0 }));
const increment = (current: Counter) => ({
  next: { count: current.count + 1 },
  result: current.count + 1,
});

describe("JsonFile", () => {
  it("reads the empty value before anything is written", async () => {
    expect(await counterFile().read()).toEqual({ count: 0 });
  });

  it("creates its folder and writes readable JSON", async () => {
    expect(await counterFile().update(increment)).toBe(1);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({ count: 1 });
  });

  it("keeps the data for a new instance, as after a server restart", async () => {
    await counterFile().update(increment);
    expect(await counterFile().read()).toEqual({ count: 1 });
  });

  it("applies simultaneous updates one after another, losing none", async () => {
    const file = counterFile();
    await Promise.all(Array.from({ length: 20 }, () => file.update(increment)));
    expect(await file.read()).toEqual({ count: 20 });
  });

  it("leaves no temporary files behind", async () => {
    await counterFile().update(increment);
    expect(await readdir(path.dirname(filePath))).toEqual(["counter.json"]);
  });

  it("keeps working after a failed update", async () => {
    const file = counterFile();
    await expect(
      file.update(() => {
        throw new Error("change failed");
      }),
    ).rejects.toThrow("change failed");
    expect(await file.update(increment)).toBe(1);
  });

  it("refuses to write data that doesn't match the schema", async () => {
    const file = counterFile();
    await expect(
      file.update(() => ({ next: { count: "many" } as never, result: undefined })),
    ).rejects.toThrow();
    expect(await file.read()).toEqual({ count: 0 });
  });

  it.each([
    ["isn't JSON", "{oops"],
    ["doesn't match the schema", JSON.stringify({ count: "many" })],
  ])("reports a file that %s, and never overwrites it", async (_label, contents) => {
    await counterFile().update(increment);
    await writeFile(filePath, contents);
    const file = counterFile();

    await expect(file.read()).rejects.toThrow(DataFileError);
    await expect(file.update(increment)).rejects.toThrow(/hasn't been changed/);
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });
});
