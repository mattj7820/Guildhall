/**
 * Regenerates the SRD's monsters and spells (app/.server/srd/monsters-5.1.json, monsters-5.2.json,
 * spells-5.1.json and spells-5.2.json) from pinned releases of openly licensed datasets made from
 * the SRD 5.1 and SRD 5.2.1 (CC BY 4.0):
 *
 * - 5e-bits' 5e-database (MIT), for every monster and spell in both versions;
 * - Open5e's open5e-api, for 2024 monsters' initiative, which 5e-bits doesn't have.
 *
 * `node scripts/import-srd.ts` writes the files; `--check` fails if they differ from what the
 * pinned data makes now (CI runs it, so a converter change can't drift unnoticed). A monster or
 * spell that disappears is refused unless `--allow-removed` is given, since stored fights and
 * sheets point at them.
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  convertMonster,
  initiativeFinder,
  type SourceMonster,
  type SrdMonster,
  type SrdVersion,
} from "./srd/convert.ts";
import { convertSpell, type SourceSpell, type SrdSpell } from "./srd/spells.ts";

const FIVE_E_BITS = {
  repo: "5e-bits/5e-srd-api",
  ref: "5e-database-v7.8.0",
  folder: "packages/5e-database/src",
};
const OPEN5E = { repo: "open5e/open5e-api", ref: "f9efac387e4adc2547d68765689fe4a2dc1445fe" };

const VERSIONS: { version: SrdVersion; folder: string; document: string }[] = [
  { version: "5.1", folder: "2014", document: "SRD 5.1" },
  { version: "5.2", folder: "2024", document: "SRD 5.2.1" },
];
type Version = (typeof VERSIONS)[number];
type Kind = "monsters" | "spells";

const outputPath = (kind: Kind, version: SrdVersion) =>
  new URL(`../app/.server/srd/${kind}-${version}.json`, import.meta.url);

const check = process.argv.includes("--check");
const allowRemoved = process.argv.includes("--allow-removed");

async function fetchJson<T>(repo: string, ref: string, path: string): Promise<T> {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

const fromFiveEBits = <T>(folder: string, file: string) =>
  fetchJson<T>(FIVE_E_BITS.repo, FIVE_E_BITS.ref, `${FIVE_E_BITS.folder}/${folder}/en/${file}`);

const FIVE_E_BITS_SOURCE = `${FIVE_E_BITS.repo} ${FIVE_E_BITS.ref}`;

async function convertMonsters(
  { version, folder, document }: Version,
  spells: SourceSpell[],
): Promise<{ source: string; monsters: SrdMonster[] }> {
  const monsters = await fromFiveEBits<SourceMonster[]>(folder, "5e-SRD-Monsters.json");
  let initiative: (name: string) => number | undefined = () => undefined;
  let spellLevels: Map<string, number> | undefined;
  const missingInitiative: string[] = [];
  if (version === "5.2") {
    initiative = initiativeFinder(
      await fetchJson(
        OPEN5E.repo,
        OPEN5E.ref,
        "data/v2/wizards-of-the-coast/srd-2024/Creature.json",
      ),
    );
    spellLevels = new Map(spells.map((spell) => [spell.index, spell.level]));
  }

  const converted = monsters.map((monster): SrdMonster => {
    const bonus = initiative(monster.name);
    if (version === "5.2" && bonus === undefined) missingInitiative.push(monster.name);
    return convertMonster(monster, version, { initiative: bonus, spellLevels });
  });
  if (missingInitiative.length) {
    console.warn(
      `${document}: no initiative found for ${missingInitiative.join(", ")}; DEX is used.`,
    );
  }
  const source = [
    FIVE_E_BITS_SOURCE,
    ...(version === "5.2" ? [`initiative from ${OPEN5E.repo} ${OPEN5E.ref.slice(0, 7)}`] : []),
  ].join("; ");
  return { source, monsters: sorted(converted, document) };
}

/** By ID, which must be unique: stored fights and sheets point at them by it. */
function sorted<T extends { id: string }>(items: T[], document: string): T[] {
  const ids = new Set<string>();
  for (const { id } of items) {
    if (ids.has(id)) throw new Error(`${document}: two entries have the ID "${id}".`);
    ids.add(id);
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

async function previousIds(kind: Kind, version: SrdVersion): Promise<string[]> {
  try {
    const previous = JSON.parse(await readFile(outputPath(kind, version), "utf8")) as Record<
      Kind,
      { id: string }[]
    >;
    return previous[kind].map(({ id }) => id);
  } catch {
    return [];
  }
}

/** Writes one file, or with `--check` compares it; false if that failed. */
async function output(
  kind: Kind,
  { version, document }: Version,
  data: { source: string } & ({ monsters: SrdMonster[] } | { spells: SrdSpell[] }),
): Promise<boolean> {
  const items: { id: string }[] = "monsters" in data ? data.monsters : data.spells;
  const text = `${JSON.stringify({ version, document, ...data }, null, 1)}\n`;
  const path = outputPath(kind, version);
  if (check) {
    const committed = await readFile(path, "utf8").catch(() => "");
    if (committed.replace(/\r\n/g, "\n") !== text) {
      console.error(`${path.pathname} is out of date: run node scripts/import-srd.ts`);
      return false;
    }
    console.log(`${document}: ${items.length} ${kind}, up to date.`);
    return true;
  }
  const kept = new Set(items.map(({ id }) => id));
  const removed = (await previousIds(kind, version)).filter((id) => !kept.has(id));
  if (removed.length && !allowRemoved) {
    console.error(
      `${document}: ${removed.join(", ")} would disappear, and stored fights or sheets may point at them. Re-run with --allow-removed if that's intended.`,
    );
    return false;
  }
  await writeFile(path, text);
  console.log(`${document}: wrote ${items.length} ${kind}.`);
  return true;
}

let failed = false;
for (const each of VERSIONS) {
  const spells = await fromFiveEBits<SourceSpell[]>(each.folder, "5e-SRD-Spells.json");
  const monsters = await convertMonsters(each, spells);
  if (!(await output("monsters", each, monsters))) failed = true;
  const converted = sorted(
    spells.map((spell) => convertSpell(spell, each.version)),
    each.document,
  );
  if (!(await output("spells", each, { source: FIVE_E_BITS_SOURCE, spells: converted })))
    failed = true;
}
if (failed) process.exitCode = 1;
