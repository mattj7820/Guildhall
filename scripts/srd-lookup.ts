/**
 * Prints an SRD monster or spell as a vault note, for the authoring skills:
 *
 *   node scripts/srd-lookup.ts monster "Goblin Boss" [--srd 2014|2024]
 *   node scripts/srd-lookup.ts spell Fireball --srd 2024
 *
 * The note goes to stdout. Without one exact match (a name in both SRDs, or no such name) it lists
 * the closest names instead and exits with 1.
 */
import { appModule } from "./app-module.ts";

// app/.server/srd/vault-notes.ts
interface Match {
  name: string;
  edition: string;
}
interface VaultNotes {
  lookUp(
    kind: string,
    query: string,
    sources?: string[],
  ): { found: Match; note: string } | { choices: Match[] };
}

const SOURCES: Record<string, string> = { "2014": "srd-5.1", "2024": "srd-5.2" };

const [kind, name, flag, rules] = process.argv.slice(2);
const source = flag === "--srd" ? SOURCES[rules ?? ""] : undefined;
if ((kind !== "monster" && kind !== "spell") || !name || (flag && !source)) {
  console.error('Usage: node scripts/srd-lookup.ts <monster|spell> "<name>" [--srd 2014|2024]');
  process.exit(2);
}

const { lookUp } = await appModule<VaultNotes>("./app/.server/srd/vault-notes.ts");
const result = lookUp(kind, name, source ? [source] : undefined);
if ("found" in result) {
  console.error(`${result.found.name}, from the ${result.found.edition}:\n`);
  console.log(result.note);
} else {
  console.error(
    result.choices.length
      ? `No single "${name}". The closest:\n` +
          result.choices.map((each) => `  ${each.name}, ${each.edition}`).join("\n")
      : `Nothing like "${name}" in the ${rules ? `${rules} SRD` : "SRDs"}.`,
  );
  process.exit(1);
}
