import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the invented fixture vault used by every test. Never a real vault. */
export const FIXTURE_VAULT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/vault",
);
