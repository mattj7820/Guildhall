import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { FIXTURE_VAULT } from "../support/fixture-vault";

/**
 * Guards the "never write to the vault" rule: fingerprint the fixture vault (every file's path,
 * size, modification time and content) before the suite, and fail the run if it changed after.
 */
export default async function globalSetup() {
  const before = await fingerprint(FIXTURE_VAULT);
  return async function globalTeardown() {
    const after = await fingerprint(FIXTURE_VAULT);
    if (after !== before) {
      throw new Error(
        "The fixture vault was modified during the test run. The app must be read-only.",
      );
    }
  };
}

async function fingerprint(root: string): Promise<string> {
  const hash = createHash("sha256");
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  for (const file of files) {
    const stats = await stat(file);
    hash.update(`${path.relative(root, file)}\0${stats.size}\0${stats.mtimeMs}\0`);
    hash.update(await readFile(file));
  }
  hash.update(`files:${files.length}`);
  return hash.digest("hex");
}
