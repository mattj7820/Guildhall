import { SRD_DOCUMENTS, type SrdSource } from "~/campaign/srd";
import type { Ability } from "~/characters/abilities";
import { srdSpellKey, type SpellOption } from "~/characters/spell-options";
import type { SpellArea, SpellLevel } from "~/characters/types";
import type { SpellText } from "~/characters/view";
import { renderMarkdown } from "~/.server/vault/render";
import srd51 from "./spells-5.1.json";
import srd52 from "./spells-5.2.json";

/** One spell as scripts/import-srd.ts writes it (scripts/srd/spells.ts). */
export interface StoredSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  material?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack: boolean;
  save?: string;
  roll?: string;
  effect?: string;
  area?: { shape: string; feet: number };
  text: string;
  higherLevel?: string;
}

interface SrdSpell {
  option: SpellOption;
  stored: StoredSpell;
}

const FILES: [SrdSource, { spells: StoredSpell[] }][] = [
  ["srd-5.1", srd51],
  ["srd-5.2", srd52],
];

let spells: Map<string, SrdSpell> | undefined;

/**
 * Every SRD spell by key, as the picker lists it. (The data is checked in tests, so every save,
 * roll and area is one a sheet can hold.)
 */
export function srdSpells(): ReadonlyMap<string, SrdSpell> {
  if (!spells) {
    spells = new Map();
    for (const [source, file] of FILES) {
      for (const stored of file.spells) {
        const srd = { source, id: stored.id };
        const key = srdSpellKey(srd);
        const { save, roll, effect, area } = stored;
        const option: SpellOption = {
          key,
          name: stored.name,
          level: stored.level as SpellLevel,
          school: stored.school,
          classes: stored.classes,
          castingTime: stored.castingTime,
          range: stored.range,
          components: stored.components,
          duration: stored.duration,
          concentration: stored.concentration,
          ritual: stored.ritual,
          attack: stored.attack,
          ...(save && { save: save as Ability }),
          ...(roll && { roll }),
          ...(effect && { effect }),
          ...(area && { area: area as SpellArea }),
          srd,
        };
        spells.set(key, { option, stored });
      }
    }
  }
  return spells;
}

const texts = new Map<string, SpellText>();

/** An SRD spell's text as the sheet shows it: rendered once, since it never changes. */
export function srdSpellText(key: string): SpellText | undefined {
  const known = texts.get(key);
  if (known) return known;
  const spell = srdSpells().get(key);
  if (!spell) return undefined;
  const { stored, option } = spell;
  const text: SpellText = {
    html: [
      // The trigger a reaction's casting time leaves out on the sheet.
      stored.castingTime.includes(", which") ? paragraph("Casting time", stored.castingTime) : "",
      markdown(stored.text),
      stored.material ? paragraph("Material", stored.material) : "",
      stored.higherLevel ? `<h4>At higher levels</h4>${markdown(stored.higherLevel)}` : "",
    ].join(""),
    source: SRD_DOCUMENTS[option.srd!.source],
  };
  texts.set(key, text);
  return text;
}

/**
 * The SRD's markdown (paragraphs, 2014's tables), sanitised as a note's would be; rendered as the
 * DM's view, which leaves nothing out (it has no DM parts, and players read all of it).
 */
const markdown = (text: string) =>
  renderMarkdown(text, { role: "dm", resolve: () => undefined, canSee: () => false });

const paragraph = (label: string, text: string) =>
  `<p><em>${label}:</em> ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
