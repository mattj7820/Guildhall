/**
 * Regenerates the SRD's monsters (app/.server/srd/monsters-5.1.json and monsters-5.2.json) from
 * pinned releases of openly licensed datasets made from the SRD 5.1 and SRD 5.2.1 (CC BY 4.0):
 *
 * - 5e-bits' 5e-database (MIT), for every monster in both versions;
 * - Open5e's open5e-api, for 2024 monsters' initiative, which 5e-bits doesn't have.
 *
 * `node scripts/import-srd.ts` writes the files; `--check` fails if they differ from what the
 * pinned data makes now (CI runs it, so a converter change can't drift unnoticed). A monster that
 * disappears is refused unless `--allow-removed` is given, since stored fights point at them.
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  convertMonster,
  initiativeFinder,
  type SourceMonster,
  type SrdMonster,
  type SrdVersion,
} from "./srd/convert.ts";

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

const outputPath = (version: SrdVersion) =>
  new URL(`../app/.server/srd/monsters-${version}.json`, import.meta.url);

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

async function convertVersion({ version, folder, document }: (typeof VERSIONS)[number]) {
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
    const spells = await fromFiveEBits<{ index: string; level: number }[]>(
      folder,
      "5e-SRD-Spells.json",
    );
    spellLevels = new Map(spells.map((spell) => [spell.index, spell.level]));
  }

  const converted = monsters
    .map((monster): SrdMonster => {
      const bonus = initiative(monster.name);
      if (version === "5.2" && bonus === undefined) missingInitiative.push(monster.name);
      return convertMonster(monster, version, { initiative: bonus, spellLevels });
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const ids = new Set<string>();
  for (const { id } of converted) {
    if (ids.has(id)) throw new Error(`${document}: two monsters have the ID "${id}".`);
    ids.add(id);
  }
  if (missingInitiative.length) {
    console.warn(
      `${document}: no initiative found for ${missingInitiative.join(", ")}; DEX is used.`,
    );
  }

  const source = [
    `${FIVE_E_BITS.repo} ${FIVE_E_BITS.ref}`,
    ...(version === "5.2" ? [`initiative from ${OPEN5E.repo} ${OPEN5E.ref.slice(0, 7)}`] : []),
  ].join("; ");
  return { version, document, source, monsters: converted };
}

async function previousIds(version: SrdVersion): Promise<string[]> {
  try {
    const previous = JSON.parse(await readFile(outputPath(version), "utf8")) as {
      monsters: SrdMonster[];
    };
    return previous.monsters.map(({ id }) => id);
  } catch {
    return [];
  }
}

let failed = false;
for (const each of VERSIONS) {
  const data = await convertVersion(each);
  const text = `${JSON.stringify(data, null, 1)}\n`;
  const path = outputPath(each.version);
  if (check) {
    const committed = await readFile(path, "utf8").catch(() => "");
    if (committed.replace(/\r\n/g, "\n") !== text) {
      console.error(`${path.pathname} is out of date: run node scripts/import-srd.ts`);
      failed = true;
    } else {
      console.log(`${each.document}: ${data.monsters.length} monsters, up to date.`);
    }
    continue;
  }
  const kept = new Set(data.monsters.map(({ id }) => id));
  const removed = (await previousIds(each.version)).filter((id) => !kept.has(id));
  if (removed.length && !allowRemoved) {
    console.error(
      `${each.document}: ${removed.join(", ")} would disappear, and stored fights may point at them. Re-run with --allow-removed if that's intended.`,
    );
    failed = true;
    continue;
  }
  await writeFile(path, text);
  console.log(`${each.document}: wrote ${data.monsters.length} monsters.`);
}
if (failed) process.exitCode = 1;
