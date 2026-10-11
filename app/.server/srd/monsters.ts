import { toHtml } from "hast-util-to-html";
import {
  statblockKey,
  type SrdSource,
  type StatblockRef,
  type StatblockView,
} from "~/combat/types";
import { statblockFromData, type Statblock } from "~/.server/vault/statblock/parse-statblock";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import srd51 from "./monsters-5.1.json";
import srd52 from "./monsters-5.2.json";

/** One of the SRD's monsters, bundled with Guildhall (made by scripts/import-srd.ts). */
export interface SrdMonster {
  key: string;
  ref: StatblockRef;
  statblock: Statblock;
  lore?: string;
}

const FILES: [SrdSource, { monsters: { id: string; statblock: unknown; lore?: string }[] }][] = [
  ["srd-5.1", srd51],
  ["srd-5.2", srd52],
];

let monsters: Map<string, SrdMonster> | undefined;

/** Every SRD monster by key, parsed once. (The data is checked in tests, so all of them parse.) */
export function srdMonsters(): ReadonlyMap<string, SrdMonster> {
  if (!monsters) {
    monsters = new Map();
    for (const [source, file] of FILES) {
      for (const { id, statblock, lore } of file.monsters) {
        const parsed = statblockFromData(statblock);
        if (!parsed.ok) continue;
        const ref: StatblockRef = { entityId: id, name: parsed.statblock.name, source };
        const key = statblockKey(ref);
        monsters.set(key, { key, ref, statblock: parsed.statblock, ...(lore && { lore }) });
      }
    }
  }
  return monsters;
}

const views = new Map<string, StatblockView>();

/** An SRD monster's statblock, rendered with its rolls marked; rendered once, since it never changes. */
export function srdStatblockView(key: string): StatblockView | undefined {
  const known = views.get(key);
  if (known) return known;
  const monster = srdMonsters().get(key);
  if (!monster) return undefined;
  const view: StatblockView = {
    html: toHtml(renderStatblock(monster.statblock, { rollable: true })),
    ...(monster.lore && { lore: monster.lore }),
  };
  views.set(key, view);
  return view;
}
