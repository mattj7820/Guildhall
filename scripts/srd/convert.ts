/**
 * Converts the SRD's monsters, as 5e-bits' 5e-database has them, into statblocks in the Fantasy
 * Statblocks plugin's format: the format Guildhall already reads from the vault, so SRD monsters
 * go through the same parser and renderer. Pure, so it can be tested on a few real records; the
 * import script fetches the data and writes the result.
 *
 * Only the layout is Guildhall's: every word of text is the SRD's as the dataset has it. Labels
 * and lists are put together the way each book prints them ("Recharge 5–6", "2/Day Each:").
 */

/** SRD 5.1 (the 2014 rules) or SRD 5.2.1 (the 2024 rules). */
export type SrdVersion = "5.1" | "5.2";

/** One converted monster, as the committed data holds it. */
export interface SrdMonster {
  /** 5e-bits' index, e.g. "goblin-warrior": stable, and unique within a version. */
  id: string;
  /** The plugin's statblock fields, plus `initiative` and `gear` for 2024 monsters. */
  statblock: Record<string, unknown>;
  /** The SRD's own description, where it has one (only some 2014 monsters). */
  lore?: string;
}

// The parts of 5e-bits' records the conversion reads.
interface Named {
  name: string;
}
interface Usage {
  type: string;
  times?: number;
  times_in_lair?: number;
  min_value?: number;
  rest_types?: string[];
}
interface Ability {
  name: string;
  desc: string;
  usage?: Usage;
  spellcasting?: {
    spells: {
      name: string;
      index?: string;
      level: number;
      usage?: Usage | null;
      notes?: string | null;
    }[];
  };
}
interface ArmorClass {
  type?: string;
  value: number;
  desc?: string;
  armor?: Named[];
  spell?: Named;
  condition?: Named;
}
export interface SourceMonster {
  index: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: ArmorClass[];
  hit_points: number;
  hit_points_roll: string;
  speed: Record<string, string | boolean>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: { value: number; proficiency: { index: string } }[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: Named[];
  senses: Record<string, string | number>;
  languages: string;
  challenge_rating: number;
  special_abilities?: Ability[];
  actions?: Ability[];
  bonus_actions?: Ability[];
  reactions?: Ability[];
  legendary_actions?: Ability[];
  gear?: string;
  desc?: string;
}

/** What the 2024 conversion takes from elsewhere. */
export interface Extras {
  /** The statblock's initiative bonus (2024 only; 5e-bits doesn't have it). */
  initiative?: number;
  /** Each spell's own level by 5e-bits' index, to show "(level 4 version)" when cast higher. */
  spellLevels?: ReadonlyMap<string, number>;
}

const ABILITY_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;
const SAVE_NAMES: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};
const SPEED_ORDER = ["walk", "burrow", "climb", "fly", "swim"];
const SENSE_ORDER = ["blindsight", "darkvision", "tremorsense", "truesight"];
const FRACTIONS: Record<number, string> = { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" };

export function convertMonster(
  monster: SourceMonster,
  version: SrdVersion,
  extras: Extras = {},
): SrdMonster {
  const modern = version === "5.2";
  // The 2024 books capitalise types, alignments, senses, speeds and conditions.
  const cased = (text: string) => (modern ? titleCase(text) : text);
  const feature = (ability: Ability) => ({
    name: ability.name + usageNote(ability, version),
    desc: modern ? withSpellList(ability, extras.spellLevels) : tidy(ability.desc),
  });
  const features = (abilities: Ability[] | undefined) => (abilities ?? []).map(feature);

  const statblock: Record<string, unknown> = {
    name: monster.name,
    size: monster.size,
    type: cased(monster.type),
    ...(monster.subtype && { subtype: monster.subtype }),
    alignment: cased(monster.alignment),
    ac: armorClass(monster.armor_class, modern),
    ...(modern && extras.initiative !== undefined && { initiative: extras.initiative }),
    hp: monster.hit_points,
    hit_dice: monster.hit_points_roll,
    speed: speed(monster.speed, modern),
    stats: ABILITY_KEYS.map((key) => monster[key]),
    saves: proficiencies(monster, "saving-throw-", (key) => SAVE_NAMES[key] ?? key),
    skillsaves: proficiencies(monster, "skill-", (key) => key.replace(/-/g, "_")),
    damage_vulnerabilities: list(monster.damage_vulnerabilities.map(cased)),
    damage_resistances: list(monster.damage_resistances.map(cased)),
    damage_immunities: list(monster.damage_immunities.map(cased)),
    condition_immunities: list(
      monster.condition_immunities.map(({ name }) => (modern ? name : name.toLowerCase())),
    ),
    ...(monster.gear && { gear: monster.gear }),
    senses: senses(monster.senses, modern),
    languages: monster.languages || "—",
    cr: FRACTIONS[monster.challenge_rating] ?? String(monster.challenge_rating),
    traits: features(monster.special_abilities),
    actions: features(monster.actions),
    bonus_actions: features(monster.bonus_actions),
    reactions: features(monster.reactions),
    legendary_actions: features(monster.legendary_actions),
  };
  for (const [key, value] of Object.entries(statblock)) {
    if (value === "" || (Array.isArray(value) && value.length === 0)) delete statblock[key];
  }
  return { id: monster.index, statblock, ...(monster.desc && { lore: plain(monster.desc) }) };
}

/**
 * Initiative bonuses by monster name, from Open5e's 2024 creatures. Lycanthropes' and vampires'
 * forms ("Werewolf, Hybrid Form") share their creature's.
 */
export function initiativeFinder(
  creatures: { fields: { name: string; initiative_bonus: number | null } }[],
): (name: string) => number | undefined {
  const byName = new Map(
    creatures.flatMap(({ fields }) =>
      typeof fields.initiative_bonus === "number"
        ? [[comparable(fields.name), fields.initiative_bonus] as const]
        : [],
    ),
  );
  return (name) => byName.get(comparable(name)) ?? byName.get(comparable(name.split(",")[0]));
}

/** Names compared without case or curly apostrophes ("Will-o’-Wisp"). */
const comparable = (name: string) => name.toLowerCase().replace(/[’‘]/g, "'").trim();

/** 2014: "15 (leather armor, shield)", "12 (15 with mage armor)", "14 (natural armor), 11 while prone". 2024: "15". */
function armorClass(entries: ArmorClass[], modern: boolean): string {
  const [first, ...others] = entries;
  if (!first) return "";
  if (modern) return String(first.value);
  const notes = [
    first.armor?.length
      ? first.armor.map(({ name }) => name.toLowerCase()).join(", ")
      : (first.desc ?? (first.type === "natural" ? "natural armor" : undefined)),
    ...others.flatMap((other) =>
      other.spell ? [`${other.value} with ${other.spell.name.toLowerCase()}`] : [],
    ),
  ].filter(Boolean);
  const conditions = others.flatMap((other) =>
    other.condition ? [`, ${other.value} while ${other.condition.name.toLowerCase()}`] : [],
  );
  return `${first.value}${notes.length ? ` (${notes.join(", ")})` : ""}${conditions.join("")}`;
}

/** "30 ft., fly 60 ft. (hover)"; 2024: "30 ft., Fly 60 ft. (hover)". */
function speed(speeds: Record<string, string | boolean>, modern: boolean): string {
  return SPEED_ORDER.flatMap((kind) => {
    const value = speeds[kind];
    if (typeof value !== "string") return [];
    const label = kind === "walk" ? "" : `${modern ? titleCase(kind) : kind} `;
    const hover = kind === "fly" && speeds.hover ? " (hover)" : "";
    return [`${label}${value}${hover}`];
  }).join(", ");
}

/** "darkvision 60 ft., passive Perception 10"; 2024: "Darkvision 60 ft.; Passive Perception 10". */
function senses(found: Record<string, string | number>, modern: boolean): string {
  const ranges = SENSE_ORDER.flatMap((sense) =>
    found[sense] === undefined ? [] : [`${modern ? titleCase(sense) : sense} ${found[sense]}`],
  );
  const passive =
    found.passive_perception === undefined
      ? []
      : [`${modern ? "Passive" : "passive"} Perception ${found.passive_perception}`];
  return modern
    ? [ranges.join(", "), ...passive].filter(Boolean).join("; ")
    : [...ranges, ...passive].join(", ");
}

/** Saves or skills in the plugin's `[{ dexterity: 4 }]` form. */
function proficiencies(
  monster: SourceMonster,
  prefix: string,
  key: (name: string) => string,
): Record<string, number>[] {
  return monster.proficiencies
    .filter(({ proficiency }) => proficiency.index.startsWith(prefix))
    .map(({ value, proficiency }) => ({ [key(proficiency.index.slice(prefix.length))]: value }));
}

/** Lists in the books join with commas, and with semicolons when an item has its own commas. */
function list(items: string[]): string {
  return items.join(items.some((item) => item.includes(",")) ? "; " : ", ");
}

/** "(Recharge 5–6)", "(3/Day)", "(3/Day, or 4/Day in Lair)", "(Recharges after a Short or Long Rest)". */
function usageNote({ name, usage }: Ability, version: SrdVersion): string {
  if (!usage || /\((?:Recharge|\d+\/Day)/i.test(name)) return "";
  switch (usage.type) {
    case "recharge on roll":
      return usage.min_value === 6 ? " (Recharge 6)" : ` (Recharge ${usage.min_value}–6)`;
    case "per day": {
      const lair =
        version === "5.2" && usage.times_in_lair ? `, or ${usage.times_in_lair}/Day in Lair` : "";
      return ` (${usage.times}/Day${lair})`;
    }
    case "recharge after rest":
      return usage.rest_types?.includes("short")
        ? " (Recharges after a Short or Long Rest)"
        : " (Recharges after a Long Rest)";
    default:
      return "";
  }
}

/**
 * The 2024 dataset keeps a Spellcasting action's spells apart from its text, which ends "…the
 * following spells:". They're listed as the book does: "At Will: …", then "2/Day Each: …".
 */
function withSpellList(ability: Ability, spellLevels?: ReadonlyMap<string, number>): string {
  const desc = tidy(ability.desc);
  const spells = ability.spellcasting?.spells.filter((spell) => spell.usage) ?? [];
  if (!desc.endsWith(":") || spells.length === 0) return desc;
  const groups = new Map<string, string[]>();
  for (const spell of spells) {
    const usage = spell.usage!;
    const group = usage.type === "at will" ? "At Will" : `${usage.times}/Day`;
    const ownLevel = spell.index ? spellLevels?.get(spell.index) : undefined;
    const notes = [
      ownLevel !== undefined && spell.level > ownLevel ? `level ${spell.level} version` : undefined,
      spell.notes ?? undefined,
    ].filter(Boolean);
    groups.set(group, [
      ...(groups.get(group) ?? []),
      `${spell.name}${notes.length ? ` (${notes.join("; ")})` : ""}`,
    ]);
  }
  const ordered = [...groups].sort(([a], [b]) => groupOrder(a) - groupOrder(b));
  const lines = ordered.map(
    ([group, names]) =>
      `${group}${group !== "At Will" && names.length > 1 ? " Each" : ""}: ${names.join(", ")}`,
  );
  return [desc, ...lines].join("\n");
}

/** At will first, then the most uses a day. */
const groupOrder = (group: string) => (group === "At Will" ? -Infinity : -parseInt(group, 10));

/** One line break between paragraphs and list items, as the statblock renders them. */
function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "from", "in", "of", "or", "the", "to"]);

/** "swarm of tiny beasts" → "Swarm of Tiny Beasts". */
/** Lore as text: a few paragraphs bold their first word in markdown ("**Bandits** rove…"). */
const plain = (text: string) => tidy(text).replace(/\*\*/g, "");

function titleCase(text: string): string {
  return text.replace(/[a-z]+/gi, (word, offset: number) =>
    offset > 0 && SMALL_WORDS.has(word) ? word : word[0].toUpperCase() + word.slice(1),
  );
}
