import { parse as parseYaml } from "yaml";
import { abilityModifier, signed } from "~/characters/abilities";
import { formatDice, parseDice } from "~/dice/parse";

/**
 * A creature statblock, parsed from the YAML inside a ```statblock code block. The YAML format is
 * the one used by the Obsidian "Fantasy Statblocks" plugin, so notes render the same in both.
 */
export interface Statblock {
  name: string;
  /** "Small humanoid (goblinoid), neutral evil" */
  description?: string;
  /** The parts of the description finding a monster filters on: "Small", "humanoid". */
  size?: string;
  type?: string;
  /** The challenge rating alone, e.g. "1/4". */
  challengeRating?: string;
  armorClass?: string;
  /** "+2 (12)": 2024 statblocks give it, and it can differ from the DEX modifier. */
  initiative?: string;
  hitPoints?: string;
  speed?: string;
  abilities?: AbilityScore[];
  savingThrows?: string;
  skills?: string;
  damageVulnerabilities?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  /** 2024 statblocks: "Leather Armor, Scimitar, Shield". */
  gear?: string;
  senses?: string;
  languages?: string;
  /** "1/4 (50 XP)" */
  challenge?: string;
  traits: Feature[];
  actions: Feature[];
  bonusActions: Feature[];
  reactions: Feature[];
  legendaryActions: Feature[];
  legendaryDescription?: string;
  /** The values tools calculate with (the combat tracker), as opposed to display text. */
  numbers: StatblockNumbers;
}

export interface StatblockNumbers {
  /** The leading number of `ac`, e.g. 15 from "15 (leather armor)". */
  armorClass?: number;
  /** The average hit points, e.g. 7. */
  hitPoints?: number;
  /** Hit dice as a canonical dice expression, e.g. "5d6 − 1". Absent if unreadable. */
  hitDice?: string;
  /**
   * The initiative bonus: the statblock's own (2024 statblocks give one, which can differ from
   * DEX), else the DEX modifier. 0 without either.
   */
  initiative: number;
  /** Squares across on a battle map, from its size: up to Medium 1, Large 2, Huge 3, Gargantuan 4. */
  squares?: 1 | 2 | 3 | 4;
}

const SQUARES_BY_SIZE: Record<string, 1 | 2 | 3 | 4> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

/** A size the token can take; "Medium or Small" (2024's people) takes the larger. */
function squaresFor(size: unknown): Pick<StatblockNumbers, "squares"> {
  const sizes = (text(size)?.toLowerCase() ?? "").split(/\s+or\s+/);
  const squares = Math.max(0, ...sizes.map((each) => SQUARES_BY_SIZE[each.trim()] ?? 0));
  return squares ? { squares: squares as 1 | 2 | 3 | 4 } : {};
}

export interface AbilityScore {
  ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  score: number;
  /** "+2", "-1" */
  modifier: string;
}

export interface Feature {
  name?: string;
  description: string;
}

export type StatblockResult = { ok: true; statblock: Statblock } | { ok: false; error: string };

const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

const ABILITY_NAMES: Record<string, string> = {
  strength: "Str",
  dexterity: "Dex",
  constitution: "Con",
  intelligence: "Int",
  wisdom: "Wis",
  charisma: "Cha",
  str: "Str",
  dex: "Dex",
  con: "Con",
  int: "Int",
  wis: "Wis",
  cha: "Cha",
};

const XP_BY_CHALLENGE: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
  "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000,
  "28": 120000, "29": 135000, "30": 155000,
}; // prettier-ignore

export function parseStatblock(source: string): StatblockResult {
  let data: unknown;
  try {
    data = parseYaml(source);
  } catch (error) {
    return { ok: false, error: `The statblock isn't valid YAML: ${firstLine(error)}` };
  }
  return statblockFromData(data);
}

/**
 * A statblock from the plugin's fields, already read from YAML or JSON. Besides the plugin's own
 * fields it reads `initiative` (a number) and `gear`, which 2024 statblocks have; the plugin keeps
 * keys it doesn't know, so notes with them still work in Obsidian.
 */
export function statblockFromData(data: unknown): StatblockResult {
  if (!isRecord(data))
    return { ok: false, error: "The statblock is empty or not a list of fields." };

  const name = text(data.name);
  const hasOwnStats =
    data.stats !== undefined || data.actions !== undefined || data.hp !== undefined;
  if (!hasOwnStats && text(data.monster)) {
    return {
      ok: false,
      error: `This statblock refers to "${text(data.monster)}" in the plugin's bestiary, which Guildhall can't read. Write the full statblock into the note to show it here.`,
    };
  }
  if (!name) return { ok: false, error: "The statblock has no name." };

  const scores = abilities(data.stats);
  const initiative = wholeNumber(data.initiative);
  return {
    ok: true,
    statblock: {
      name,
      description: describe(data),
      size: text(data.size),
      type: text(data.type),
      challengeRating: text(data.cr),
      armorClass: text(data.ac),
      ...(initiative !== undefined && {
        initiative: `${signed(initiative)} (${10 + initiative})`,
      }),
      hitPoints: hitPoints(data.hp, data.hit_dice),
      speed: text(data.speed),
      abilities: scores,
      savingThrows: bonuses(
        data.saves,
        (key) => ABILITY_NAMES[key.toLowerCase()] ?? titleCase(key),
      ),
      skills: bonuses(data.skillsaves, titleCase),
      damageVulnerabilities: text(data.damage_vulnerabilities),
      damageResistances: text(data.damage_resistances),
      damageImmunities: text(data.damage_immunities),
      conditionImmunities: text(data.condition_immunities),
      gear: text(data.gear),
      senses: text(data.senses),
      languages: text(data.languages),
      challenge: challenge(data.cr),
      traits: [...features(data.traits), ...spellcasting(data.spells)],
      actions: features(data.actions),
      bonusActions: features(data.bonus_actions),
      reactions: features(data.reactions),
      legendaryActions: features(data.legendary_actions),
      legendaryDescription: text(data.legendary_description),
      numbers: {
        armorClass: leadingNumber(data.ac),
        hitPoints: leadingNumber(data.hp),
        hitDice: diceExpression(data.hit_dice),
        initiative: initiative ?? (scores ? abilityModifier(scores[1].score) : 0),
        ...squaresFor(data.size),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strings and numbers become trimmed text; blanks (the plugin writes `""`) become undefined. */
function text(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** "Small humanoid (goblinoid), neutral evil" */
function describe(data: Record<string, unknown>): string | undefined {
  const kind = [text(data.size), text(data.type)].filter(Boolean).join(" ");
  const subtype = text(data.subtype);
  const full = [kind + (subtype ? ` (${subtype})` : ""), text(data.alignment)]
    .filter(Boolean)
    .join(", ");
  return full || undefined;
}

/** `hp: 1`, `hit_dice: 1d4 + -2` → "1 (1d4 − 2)" */
function hitPoints(hp: unknown, hitDice: unknown): string | undefined {
  const points = text(hp);
  const dice = text(hitDice)
    ?.replace(/\+\s*-\s*/g, "− ")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*-\s*(?=\d)/g, " − ");
  if (points && dice) return `${points} (${dice})`;
  return points ?? dice;
}

function wholeNumber(value: unknown): number | undefined {
  const number = typeof value === "string" ? Number(value.trim() || NaN) : value;
  return typeof number === "number" && Number.isInteger(number) ? number : undefined;
}

function leadingNumber(value: unknown): number | undefined {
  const match = /^\d+/.exec(text(value) ?? "");
  return match ? Number(match[0]) : undefined;
}

function diceExpression(value: unknown): string | undefined {
  const parsed = parseDice(text(value) ?? "");
  return parsed.ok ? formatDice(parsed.expression) : undefined;
}

function abilities(stats: unknown): AbilityScore[] | undefined {
  if (!Array.isArray(stats) || stats.length !== 6) return undefined;
  const scores = stats.map(Number);
  if (scores.some((score) => !Number.isFinite(score))) return undefined;
  return scores.map((score, index) => ({
    ability: ABILITIES[index],
    score,
    modifier: signed(abilityModifier(score)),
  }));
}

/** Saves and skills come as `[{dexterity: 4}]` (the plugin's format) or `{dexterity: 4}`. */
function bonuses(value: unknown, label: (key: string) => string): string | undefined {
  const entries = Array.isArray(value)
    ? value.filter(isRecord).flatMap((entry) => Object.entries(entry))
    : isRecord(value)
      ? Object.entries(value)
      : [];
  const parts = entries
    .map(([key, bonus]) => {
      const number = Number(bonus);
      return Number.isFinite(number) ? `${label(key)} ${signed(number)}` : undefined;
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function challenge(cr: unknown): string | undefined {
  const rating = text(cr);
  if (!rating) return undefined;
  const xp = XP_BY_CHALLENGE[rating];
  return xp === undefined ? rating : `${rating} (${xp.toLocaleString("en-US")} XP)`;
}

function features(value: unknown): Feature[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Feature[] => {
    if (typeof entry === "string") return entry.trim() ? [{ description: entry.trim() }] : [];
    if (!isRecord(entry)) return [];
    const description = text(entry.desc) ?? text(entry.description) ?? "";
    const name = text(entry.name);
    return name || description ? [{ name, description }] : [];
  });
}

/**
 * The plugin's `spells` list: plain strings are the intro and notes, and `{"1st level (4 slots)":
 * "shield, magic missile"}` entries are the spell lists. Rendered as one Spellcasting trait.
 */
function spellcasting(value: unknown): Feature[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const lines = value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (isRecord(entry)) {
      return Object.entries(entry).map(([level, spells]) => `${level}: ${text(spells) ?? ""}`);
    }
    return [];
  });
  return lines.length ? [{ name: "Spellcasting", description: lines.join("\n") }] : [];
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0];
}
