/**
 * Regenerates app/characters/item-icons.ts from game-icons.net (CC BY 3.0), keeping each icon's
 * author for the credits. Run by hand when the icon set changes, then format:
 * `node scripts/import-item-icons.mjs && npx prettier --write app/characters/item-icons.ts`.
 * Only the icon's path data is kept, so tiles can draw it in the app's own colours.
 */
import { writeFile } from "node:fs/promises";

const SOURCE = "https://raw.githubusercontent.com/game-icons/icons/master";

/** Folder names in the game-icons repository, and how game-icons.net credits them. */
const AUTHORS = {
  lorc: "Lorc",
  delapouite: "Delapouite",
  willdabeast: "Willdabeast",
  lucasms: "Lucas",
  "carl-olsen": "Carl Olsen",
};

/** [id, label, source, extra keywords] — keywords help quick add guess an icon from a name. */
const ICONS = [
  ["bag", "Bag", "lorc/swap-bag", ["pouch", "sack", "purse"]],
  ["backpack", "Backpack", "delapouite/backpack", ["pack", "knapsack"]],
  ["chest", "Chest", "delapouite/chest", ["box", "crate", "coffer"]],
  ["rope", "Rope", "delapouite/rope-coil", ["cord", "line"]],
  ["torch", "Torch", "delapouite/torch", []],
  ["lantern", "Lantern", "lorc/lantern-flame", ["lamp"]],
  ["candle", "Candle", "lorc/candle-light", []],
  ["sword", "Sword", "lorc/broadsword", ["blade", "longsword", "shortsword", "rapier", "scimitar"]],
  ["dagger", "Dagger", "lorc/plain-dagger", ["knife", "dirk"]],
  ["axe", "Axe", "lorc/battle-axe", ["hatchet", "handaxe", "greataxe"]],
  ["mace", "Mace", "lorc/spiked-mace", ["club", "morningstar", "flail", "hammer"]],
  ["spear", "Spear", "lorc/stone-spear", ["javelin", "pike", "halberd", "glaive"]],
  ["bow", "Bow", "delapouite/bow-arrow", ["longbow", "shortbow"]],
  ["crossbow", "Crossbow", "carl-olsen/crossbow", []],
  ["arrows", "Arrows", "lorc/arrow-cluster", ["arrow", "bolts", "ammunition"]],
  ["quiver", "Quiver", "delapouite/quiver", []],
  ["staff", "Staff", "lorc/wizard-staff", ["quarterstaff", "stick"]],
  ["wand", "Wand", "lorc/fairy-wand", ["rod"]],
  ["shield", "Shield", "willdabeast/round-shield", ["buckler"]],
  ["armour", "Armour", "lorc/breastplate", ["armor", "plate", "breastplate"]],
  ["leather-armour", "Leather armour", "delapouite/leather-armor", ["leather", "jerkin"]],
  ["chain-mail", "Chain mail", "willdabeast/chain-mail", ["mail", "chain"]],
  ["boots", "Boots", "lorc/boots", ["shoes"]],
  ["gloves", "Gloves", "delapouite/gloves", ["gauntlets", "wraps", "handwraps"]],
  ["cloak", "Cloak", "lucasms/cloak", ["cape", "robe"]],
  ["hat", "Hat", "lorc/pointy-hat", ["cap", "hood", "helmet"]],
  ["ring", "Ring", "delapouite/ring", ["band"]],
  ["amulet", "Amulet", "lorc/gem-pendant", ["necklace", "pendant", "locket", "talisman"]],
  ["potion", "Potion", "delapouite/health-potion", ["healing", "elixir", "tonic"]],
  ["flask", "Flask", "lorc/round-bottom-flask", ["vial", "oil", "acid", "poison"]],
  ["scroll", "Scroll", "lorc/scroll-unfurled", ["parchment"]],
  ["book", "Book", "delapouite/spell-book", ["spellbook", "tome", "journal", "diary"]],
  ["letter", "Letter", "lorc/envelope", ["note", "message", "envelope"]],
  ["map", "Map", "lorc/treasure-map", ["chart"]],
  ["key", "Key", "lorc/key", []],
  ["lockpicks", "Lockpicks", "delapouite/lockpicks", ["thieves", "picks"]],
  [
    "gem",
    "Gem",
    "lorc/cut-diamond",
    ["diamond", "ruby", "emerald", "sapphire", "jewel", "crystal"],
  ],
  ["coins", "Coins", "delapouite/two-coins", ["coin", "gold", "silver", "copper"]],
  ["bread", "Bread", "delapouite/bread", ["rations", "ration", "food", "loaf"]],
  ["meat", "Meat", "lorc/meat", ["jerky", "ham"]],
  ["cheese", "Cheese", "lorc/cheese-wedge", []],
  ["waterskin", "Waterskin", "delapouite/water-flask", ["water", "canteen"]],
  ["bottle", "Bottle", "delapouite/wine-bottle", ["wine", "ale", "beer", "drink"]],
  ["herbs", "Herbs", "delapouite/herbs-bundle", ["herb", "plant", "flower"]],
  ["bedroll", "Bedroll", "delapouite/sleeping-bag", ["blanket", "sleeping"]],
  ["tent", "Tent", "delapouite/camping-tent", []],
  ["tools", "Tools", "lorc/hammer-nails", ["tool", "kit", "nails", "crowbar"]],
  ["cooking-pot", "Cooking pot", "lorc/cauldron", ["pot", "cauldron", "mess"]],
  ["utensils", "Utensils", "lorc/kitchen-knives", ["spatula", "ladle", "cutlery", "fork", "spoon"]],
  ["instrument", "Instrument", "delapouite/flute", ["flute", "lute", "drum", "horn", "music"]],
  ["crystal-ball", "Crystal ball", "lorc/crystal-ball", ["orb", "sphere"]],
  ["holy-symbol", "Holy symbol", "lorc/holy-symbol", ["symbol", "emblem", "idol"]],
  ["compass", "Compass", "lorc/compass", []],
  ["quill", "Quill and ink", "lorc/quill-ink", ["ink", "pen", "quill"]],
  ["tooth", "Trophy", "lorc/tooth", ["tooth", "fang", "claw", "bone"]],
  ["dice", "Dice", "delapouite/dice-twenty-faces-twenty", ["die", "game"]],
  ["curio", "Curio", "lorc/magic-swirl", ["strange", "mysterious", "trinket", "magic", "odd"]],
];

const BACKGROUND = "M0 0h512v512H0z";

async function pathData(source) {
  const response = await fetch(`${SOURCE}/${source}.svg`);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('viewBox="0 0 512 512"')) throw new Error(`${source}: unexpected viewBox`);
  const leftovers = svg.replace(/<\/?svg[^>]*>|<path[^>]*\/>/g, "").trim();
  if (leftovers) throw new Error(`${source}: has more than paths (${leftovers.slice(0, 60)})`);
  const paths = [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  const icon = paths.filter((d) => d !== BACKGROUND);
  if (icon.length === 0) throw new Error(`${source}: no icon path`);
  return icon.join("");
}

const entries = [];
for (const [id, label, source, keywords] of ICONS) {
  const folder = source.split("/")[0];
  const author = AUTHORS[folder];
  if (!author) throw new Error(`${source}: add its author to AUTHORS`);
  entries.push({ id, label, author, source, keywords, path: await pathData(source) });
}

const body = entries
  .map(
    (icon) =>
      `  {\n    id: ${JSON.stringify(icon.id)},\n    label: ${JSON.stringify(icon.label)},\n` +
      `    author: ${JSON.stringify(icon.author)},\n    source: ${JSON.stringify(icon.source)},\n` +
      `    keywords: ${JSON.stringify(icon.keywords)},\n    path: ${JSON.stringify(icon.path)},\n  },`,
  )
  .join("\n");

const file = `/**
 * Item icons from game-icons.net, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
 * Each icon keeps its author for the credits. Generated by scripts/import-item-icons.mjs; don't edit
 * by hand. Paths are drawn on a 512×512 canvas.
 */

export interface ItemIcon {
  id: string;
  label: string;
  author: string;
  /** Where it came from in the game-icons repository (author folder and icon name). */
  source: string;
  /** Words in an item's name that suggest this icon, besides its label. */
  keywords: readonly string[];
  path: string;
}

export const ITEM_ICONS: readonly ItemIcon[] = [
${body}
];
`;

await writeFile(new URL("../app/characters/item-icons.ts", import.meta.url), file, "utf8");
console.log(`Wrote ${entries.length} icons.`);
