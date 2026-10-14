/**
 * Checks a note the way Guildhall will read it, for the authoring skills, before it goes into the
 * vault (or after):
 *
 *   node scripts/check-note.ts <file.md> [monster|spell|item]
 *
 * Prints what Guildhall makes of it, and exits with 1 if anything would be dropped or refused.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { appModule } from "./app-module.ts";

// app/.server/vault/check-note.ts
interface CheckNote {
  checkNote(path: string, source: string, kind?: string): { problems: string[]; notes: string[] };
}

const [file, kind] = process.argv.slice(2);
if (!file || (kind && !["monster", "spell", "item"].includes(kind))) {
  console.error("Usage: node scripts/check-note.ts <file.md> [monster|spell|item]");
  process.exit(2);
}

const { checkNote } = await appModule<CheckNote>("./app/.server/vault/check-note.ts");
const { problems, notes } = checkNote(basename(file), await readFile(file, "utf8"), kind);
for (const note of notes) console.log(`- ${note}`);
for (const problem of problems) console.log(`✗ ${problem}`);
console.log(
  problems.length ? "\nGuildhall won't read this as meant." : "\nGuildhall reads this as meant.",
);
process.exit(problems.length ? 1 : 0);
